// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, subjectId, questionId, isCorrect, myAnswer, currentIndex, isFavorite } = event

  // 1. 获取科目列表及进度
  if (action === 'getSubjectList') {
    // 获取用户在该科目下的进度
    const progressRes = await db.collection('study_progress').where({
      _openid: openid
    }).get()

    // 转换为 Map 方便查找: subjectId -> progressData
    const progressMap = {}
    progressRes.data.forEach(item => {
      progressMap[item.subjectId] = item
    })

    return {
      code: 0,
      data: progressMap
    }
  }

  // 2. 获取科目详情（进度、错题、收藏状态）
  if (action === 'getSubjectDetail') {
    if (!subjectId) return { code: -1, msg: 'subjectId required' }

    // 直接从 study_progress 获取
    const progressRes = await db.collection('study_progress').where({ _openid: openid, subjectId }).get()
    
    let progress = progressRes.data[0] || { answers: {}, lastIndex: 0, favoriteIds: [], mistakeIds: [] }
    let favoriteIds = progress.favoriteIds || []
    let mistakeIds = progress.mistakeIds || []

    return {
      code: 0,
      data: {
        lastIndex: progress.lastIndex || 0,
        answers: progress.answers || {}, // questionId -> { myAnswer, isCorrect }
        favoriteIds,
        mistakeIds
      }
    }
  }

  // 3. 提交答案
  if (action === 'submitAnswer') {
    if (!subjectId || questionId === undefined) return { code: -1, msg: 'params missing' }

    const now = new Date()
    
    // 更新进度表 (study_progress)
    // 查找是否存在记录
    const progressRes = await db.collection('study_progress').where({ _openid: openid, subjectId }).get()
    
    let docId = null
    let currentAnswers = {}
    
    if (progressRes.data.length > 0) {
      docId = progressRes.data[0]._id
      currentAnswers = progressRes.data[0].answers || {}
    } else {
      // 创建新记录
      const addRes = await db.collection('study_progress').add({
        data: {
          _openid: openid,
          subjectId,
          createTime: now,
          answers: {},
          totalAnswered: 0,
          correctCount: 0,
          lastIndex: 0,
          favoriteIds: [],
          mistakeIds: []
        }
      })
      docId = addRes._id
    }

    // 更新 answers Map
    currentAnswers[questionId] = { myAnswer, isCorrect, time: now }
    
    // 重新统计
    const totalAnswered = Object.keys(currentAnswers).length
    const correctCount = Object.values(currentAnswers).filter(a => a.isCorrect).length

    // 准备更新数据
    const updateData = {
      [`answers.${questionId}`]: { myAnswer, isCorrect, time: now },
      lastIndex: currentIndex,
      totalAnswered,
      correctCount,
      updateTime: now
    }

    // 维护 mistakeIds 列表
    if (!isCorrect) {
      updateData.mistakeIds = _.addToSet(questionId)
    } else {
      updateData.mistakeIds = _.pull(questionId)
    }

    await db.collection('study_progress').doc(docId).update({
      data: updateData
    })

    return { code: 0, msg: 'success' }
  }

  // 4. 切换收藏
  if (action === 'toggleFavorite') {
    if (!subjectId || questionId === undefined) return { code: -1, msg: 'params missing' }
    
    // 更新 study_progress 中的 favoriteIds 列表
    const progressRes = await db.collection('study_progress').where({ _openid: openid, subjectId }).get()
    
    if (progressRes.data.length > 0) {
      const docId = progressRes.data[0]._id
      await db.collection('study_progress').doc(docId).update({
        data: {
          favoriteIds: isFavorite ? _.addToSet(questionId) : _.pull(questionId)
        }
      })
    } else {
      // 如果没有进度记录，则创建
      if (isFavorite) {
         await db.collection('study_progress').add({
          data: {
            _openid: openid,
            subjectId,
            createTime: new Date(),
            answers: {},
            totalAnswered: 0,
            correctCount: 0,
            lastIndex: 0,
            favoriteIds: [questionId],
            mistakeIds: []
          }
        })
      }
    }
    
    return { code: 0, msg: 'success' }
  }

  // 5. 获取个人中心统计数据
  if (action === 'getUserStats') {
    // 聚合查询所有科目的进度
    const progressRes = await db.collection('study_progress').where({ _openid: openid }).get()
    
    let totalQuestions = 0
    let correctQuestions = 0
    let studyDaysSet = new Set() // 使用 Set 统计学习天数

    progressRes.data.forEach(item => {
      totalQuestions += (item.totalAnswered || 0)
      correctQuestions += (item.correctCount || 0)
      
      // 统计 createTime
      if (item.createTime) {
        const dateStr = new Date(item.createTime).toDateString()
        studyDaysSet.add(dateStr)
      }
      // 统计 updateTime
      if (item.updateTime) {
         const dateStr = new Date(item.updateTime).toDateString()
         studyDaysSet.add(dateStr)
      }
      
      // 遍历 answers 里的时间
      if (item.answers) {
        Object.values(item.answers).forEach(ans => {
           if (ans.time) {
             const d = new Date(ans.time).toDateString()
             studyDaysSet.add(d)
           }
        })
      }
    })

    const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0

    return {
      code: 0,
      data: {
        totalQuestions,
        correctQuestions,
        accuracy,
        studyDays: studyDaysSet.size
      }
    }
  }

  // 6. 获取记录列表（收藏/错题）
  if (action === 'getRecordList') {
    const { type } = event // 'favorite' or 'mistake'
    
    // 从 study_progress 聚合所有科目的收藏/错题
    const progressRes = await db.collection('study_progress').where({ _openid: openid }).get()
    
    let resultList = []
    
    progressRes.data.forEach(progress => {
      const ids = type === 'favorite' ? (progress.favoriteIds || []) : (progress.mistakeIds || [])
      
      ids.forEach(qId => {
        resultList.push({
          subjectId: progress.subjectId,
          questionId: qId,
          createTime: progress.updateTime || progress.createTime // 使用最后更新时间作为近似时间，或者不返回
        })
      })
    })
    
    // 如果需要排序，可以按 subjectId 排序，或者按近似时间排序
    // 这里简单按 subjectId 排序
    resultList.sort((a, b) => a.subjectId - b.subjectId)
      
    return {
      code: 0,
      data: resultList
    }
  }

  return { code: -1, msg: 'unknown action' }
}
