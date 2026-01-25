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

    // 并行查询：进度、错题、收藏
    const tasks = [
      db.collection('study_progress').where({ _openid: openid, subjectId }).get(),
      db.collection('mistakes').where({ _openid: openid, subjectId }).count(), // 只拿数量或 IDs? 详情页可能需要 IDs 来标记
      db.collection('favorites').where({ _openid: openid, subjectId }).get() // 收藏列表
    ]

    // 为了获取错题 ID 列表，如果数量不大可以直接 get，如果很大建议只在翻页时查
    // 这里为了简单，直接查出该科目下所有错题 ID
    const mistakeIdsTask = db.collection('mistakes').where({ _openid: openid, subjectId }).field({ questionId: true }).get()

    const [progressRes, mistakeCountRes, favRes, mistakeIdsRes] = await Promise.all([
      db.collection('study_progress').where({ _openid: openid, subjectId }).get(),
      db.collection('mistakes').where({ _openid: openid, subjectId }).count(),
      db.collection('favorites').where({ _openid: openid, subjectId }).field({ questionId: true }).get(),
      db.collection('mistakes').where({ _openid: openid, subjectId }).field({ questionId: true }).get()
    ])

    const progress = progressRes.data[0] || { answers: {}, lastIndex: 0 }
    
    // 提取 ID 列表
    const favoriteIds = favRes.data.map(item => item.questionId)
    const mistakeIds = mistakeIdsRes.data.map(item => item.questionId)

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
    
    // A. 更新进度表 (study_progress)
    // 查找是否存在记录
    const progressRes = await db.collection('study_progress').where({ _openid: openid, subjectId }).get()
    
    let updateData = {
      [`answers.${questionId}`]: {
        myAnswer,
        isCorrect,
        time: now
      },
      lastIndex: currentIndex,
      updateTime: now
    }

    // 计算统计数据 (totalAnswered, correctCount)
    // 注意：这里简单处理，如果想精确统计，需要读取旧的 answers 进行比对。
    // 为避免并发问题，可以使用原子操作，但 answers 是个 Map，较难直接原子更新 count
    // 简单策略：读取 -> 内存计算 -> 更新
    
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
          lastIndex: 0
        }
      })
      docId = addRes._id
    }

    // 更新 answers Map
    currentAnswers[questionId] = { myAnswer, isCorrect, time: now }
    
    // 重新统计
    const totalAnswered = Object.keys(currentAnswers).length
    const correctCount = Object.values(currentAnswers).filter(a => a.isCorrect).length

    await db.collection('study_progress').doc(docId).update({
      data: {
        [`answers.${questionId}`]: { myAnswer, isCorrect, time: now },
        lastIndex: currentIndex,
        totalAnswered,
        correctCount,
        updateTime: now
      }
    })

    // B. 更新错题本 (mistakes)
    if (!isCorrect) {
      // 答错：加入错题本 (如果不存在)
      const mistakeCheck = await db.collection('mistakes').where({ _openid: openid, subjectId, questionId }).count()
      if (mistakeCheck.total === 0) {
        await db.collection('mistakes').add({
          data: { _openid: openid, subjectId, questionId, myAnswer, createTime: now }
        })
      }
    } else {
      // 答对：从错题本移除 (可选策略：答对一次就移除，或者多次答对才移除。这里采用答对即移除)
      await db.collection('mistakes').where({ _openid: openid, subjectId, questionId }).remove()
    }

    return { code: 0, msg: 'success' }
  }

  // 4. 切换收藏
  if (action === 'toggleFavorite') {
    if (!subjectId || questionId === undefined) return { code: -1, msg: 'params missing' }
    
    if (isFavorite) {
      // 添加收藏
      const check = await db.collection('favorites').where({ _openid: openid, subjectId, questionId }).count()
      if (check.total === 0) {
        await db.collection('favorites').add({
          data: { _openid: openid, subjectId, questionId, createTime: new Date() }
        })
      }
    } else {
      // 取消收藏
      await db.collection('favorites').where({ _openid: openid, subjectId, questionId }).remove()
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
      
      // 遍历 answers 里的时间 (如果数据量大，这样可能性能不好，简化版只看 updateTime/createTime)
      // 为了更精确，可以遍历 answers
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
    const collectionName = type === 'favorite' ? 'favorites' : 'mistakes'
    
    // 获取列表，按时间倒序
    const res = await db.collection(collectionName)
      .where({ _openid: openid })
      .orderBy('createTime', 'desc')
      .get()
      
    return {
      code: 0,
      data: res.data
    }
  }

  return { code: -1, msg: 'unknown action' }
}