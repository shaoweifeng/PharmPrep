// pages/exercise/exerciseDetail.js
const pharmacologyData = require('../../data/questions/pharmacology.js')

Page({
  data: {
    currentIndex: 0,
    totalCount: 0,
    questionList: [],
    currentQuestion: {},
    showAnswer: false,
    userAnswer: '', // String for single/TF, Array for multiple
    isCorrect: false,
    isFavorite: false,
    questionTypeMap: {
      1: '单选题',
      2: '多选题',
      3: '判断题'
    },
    reviewType: ''
  },

  onLoad(options) {
    const { subjectId, subjectName, mode, listIndex, type } = options
    this.subjectId = subjectId // 保存到实例变量
    this.mode = mode || 'practice' // practice, review
    this.setData({ reviewType: type || '' })

    if (subjectName) {
      wx.setNavigationBarTitle({
        title: subjectName + (mode === 'review' ? '详情' : '练习')
      })
    }
    
    // 1. 先加载题目
    if (this.mode === 'review') {
      // 回顾模式下，题目列表来自于上个页面的传递
      const reviewList = wx.getStorageSync('reviewList') || []
      this.reviewList = reviewList // 保存原始记录列表
      
      // 将 reviewList 转换为题目格式
      // 注意：reviewList 里的 item 包含 subjectId, questionId, myAnswer 等
      // 我们需要根据这些信息去题库里找完整的题目信息
      // 但这里有个问题：reviewList 可能包含不同科目的题目（如果支持全科目收藏），但目前详情页是按科目进的
      // 假设 reviewList 里的题目都是当前 subjectId 的，或者是混合的？
      // 这里的 subjectId 参数可能只是为了标识当前上下文。
      // 如果 record-list 支持多科目混合，那详情页也得支持动态切换 subjectId（这比较复杂，因为 loadQuestions 依赖 subjectId）
      // 简化处理：假设 reviewList 里的题目都能在本地题库找到。
      
      this.loadReviewQuestions(reviewList, listIndex)
    } else {
      this.loadQuestions(subjectId)
      // 2. 再加载云端进度
      this.loadCloudProgress(subjectId)
    }
  },

  // 加载回顾模式的题目列表
  loadReviewQuestions(reviewList, initialListIndex) {
    // 引入题库 (目前只有药理学，后续需扩展)
    // 这里的 id 映射逻辑需要和 record-list 保持一致
    const pharmacologyData = require('../../data/questions/pharmacology.js')
    const subjectMap = {
      '1': { data: pharmacologyData.prompt1_result }
    }

    const questionList = reviewList.map(item => {
      const { subjectId, questionId, myAnswer } = item
      const subject = subjectMap[subjectId]
      let questionData = null

      if (subject && subject.data) {
        // 查找逻辑同 record-list
        // 修复：直接使用 find 查找，避免直接使用索引导致的错位问题（因为 No 通常从 1 开始，而索引从 0 开始）
        questionData = subject.data.find((q, idx) => String(q.No || idx) === String(questionId))
      }

      if (!questionData) return null

      // 格式化为详情页需要的结构
      let type = 1
      if (questionData.type === 'multiple_choice') type = 2
      if (questionData.type === 'true_false') type = 3

      const options = []
      const keys = Object.keys(questionData.choice).sort()
      keys.forEach(key => {
        options.push({
          id: key,
          label: key,
          content: questionData.choice[key],
          selected: false
        })
      })

      if (type === 3) {
        options.forEach(opt => {
          if (opt.id === 'True') { opt.label = '正确'; opt.content = '' }
          if (opt.id === 'False') { opt.label = '错误'; opt.content = '' }
        })
      }

      // 回显用户答案和正确答案
      let userAnswer = ''
      if (myAnswer) userAnswer = myAnswer // myAnswer 在数据库里已经是存好的格式（string or array）
      
      // 计算是否正确 (复用逻辑)
      let isCorrect = false
      if (Array.isArray(questionData.answer)) {
        if (Array.isArray(userAnswer) && 
            userAnswer.length === questionData.answer.length &&
            userAnswer.every((val, i) => val === questionData.answer[i])) {
          isCorrect = true
        }
      } else {
        isCorrect = userAnswer === questionData.answer
      }

      // 标记选项
      const markedOptions = options.map(opt => {
        let isOptCorrect = false
        if (Array.isArray(questionData.answer)) {
          isOptCorrect = questionData.answer.includes(opt.id)
        } else {
          isOptCorrect = questionData.answer === opt.id
        }
        
        let isSelected = false
        if (Array.isArray(userAnswer)) {
          isSelected = userAnswer.includes(opt.id)
        } else {
          isSelected = userAnswer === opt.id
        }

        return {
          ...opt,
          isCorrect: isOptCorrect,
          selected: isSelected
        }
      })

      return {
        id: questionData.No || questionId, // 保持 ID 一致性
        type,
        title: questionData.question,
        options: markedOptions,
        correctAnswer: questionData.answer,
        analysis: questionData.explanation,
        // 附加信息
        myAnswer: userAnswer,
        userIsCorrect: isCorrect,
        recordId: item._id // 记录在云端的 ID，用于删除等操作
      }
    }).filter(q => q !== null)

    const currentIndex = parseInt(initialListIndex) || 0

    this.setData({
      questionList,
      totalCount: questionList.length,
      currentIndex,
      currentQuestion: questionList[currentIndex],
      showAnswer: true, // 回顾模式默认显示答案
      userAnswer: questionList[currentIndex].myAnswer,
      isCorrect: questionList[currentIndex].userIsCorrect,
      isFavorite: true // 收藏列表进来的默认是收藏，错题列表进来的可能不一定？暂且不操作
    })
    
    // 加载当前题目的收藏状态（因为错题本里的题不一定收藏了）
    this.checkFavoriteStatus(questionList[currentIndex].id)
  },

  // 检查特定题目的收藏状态
  checkFavoriteStatus(questionId) {
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'getSubjectDetail', // 这里用 getSubjectDetail 有点重，最好有个 checkFavorite
        subjectId: this.subjectId
      },
      success: res => {
        if (res.result && res.result.code === 0) {
          const { favoriteIds } = res.result.data
          const isFav = favoriteIds.includes(String(questionId))
          this.setData({ isFavorite: isFav })
        }
      }
    })
  },

  // 上一题
  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const newIndex = this.data.currentIndex - 1
      this.switchQuestion(newIndex)
    } else {
      wx.showToast({
        title: '已经是第一题了',
        icon: 'none'
      })
    }
  },

  // 下一题
  nextQuestion() {
    if (this.data.currentIndex < this.data.totalCount - 1) {
      const newIndex = this.data.currentIndex + 1
      this.switchQuestion(newIndex)
    } else {
      wx.showToast({
        title: '已经是最后一题了',
        icon: 'none'
      })
    }
  },

  // 切换题目通用逻辑
  switchQuestion(index) {
    const question = this.data.questionList[index]
    
    // 如果是 review 模式，直接显示答案状态
    if (this.mode === 'review') {
      this.setData({
        currentIndex: index,
        currentQuestion: question,
        userAnswer: question.myAnswer,
        isCorrect: question.userIsCorrect,
        showAnswer: true
      })
      this.checkFavoriteStatus(question.id)
    } else {
      // 练习模式逻辑
      this.setData({
        currentIndex: index,
        currentQuestion: question,
        showAnswer: false,
        userAnswer: '',
        isCorrect: false,
        isFavorite: question.isFavorite || false
      })
    }
  },

  // 加载云端进度
  loadCloudProgress(subjectId, restoreProgress = true) {
    if (restoreProgress) {
      wx.showLoading({ title: '同步进度中...' })
    }
    
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'getSubjectDetail',
        subjectId
      },
      success: res => {
        if (restoreProgress) wx.hideLoading()
        if (res.result && res.result.code === 0) {
          const { lastIndex, answers, favoriteIds, mistakeIds } = res.result.data
          
          let targetIndex = this.data.currentIndex
          
          if (restoreProgress) {
            // 恢复做题进度（跳转到上次做的题目）
            targetIndex = lastIndex
            if (targetIndex >= this.data.totalCount) targetIndex = this.data.totalCount - 1
            if (targetIndex < 0) targetIndex = 0
          }

          // 更新题目列表中的状态（收藏、是否做过）
          const newQuestionList = this.data.questionList.map(q => {
            const isFav = favoriteIds.includes(String(q.id))
            return {
              ...q,
              isFavorite: isFav
            }
          })

          const updateData = {
            questionList: newQuestionList,
            isFavorite: newQuestionList[targetIndex].isFavorite || false
          }
          
          if (restoreProgress) {
             updateData.currentIndex = targetIndex
             updateData.currentQuestion = newQuestionList[targetIndex]
          } else {
             // 如果不恢复进度（review模式），只需更新当前题目的收藏状态
             // 因为 initReviewMode 已经设置了 currentIndex 和 currentQuestion
             // 但 currentQuestion 是旧对象，需要更新其 isFavorite
             const currentQ = this.data.currentQuestion
             updateData.currentQuestion = {
               ...currentQ,
               isFavorite: newQuestionList[this.data.currentIndex].isFavorite
             }
          }

          this.setData(updateData)
        }
      },
      fail: err => {
        if (restoreProgress) wx.hideLoading()
        console.error('同步进度失败', err)
      }
    })
  },

  loadQuestions(subjectId) {
    // 根据 subjectId 加载对应题库（假设药理学 ID 为 1）
    if (subjectId == '1') {
      const rawQuestions = (pharmacologyData && pharmacologyData.prompt1_result) ? pharmacologyData.prompt1_result : []
      // 转换数据格式
      const questionList = rawQuestions.map((item, index) => {
        let type = 1
        if (item.type === 'multiple_choice') type = 2
        if (item.type === 'true_false') type = 3
  
        // 处理选项
        const options = []
        // 按照 A, B, C, D, E ... 排序
        const keys = Object.keys(item.choice).sort()
        keys.forEach(key => {
          options.push({
            id: key,
            label: key, // 对于判断题，这里可能是 "True"/"False"
            content: item.choice[key],
            selected: false
          })
        })
  
        // 处理判断题的 label 显示
      if (type === 3) {
        options.forEach(opt => {
          if (opt.id === 'True') {
            opt.label = '正确'
            opt.content = ''
          }
          if (opt.id === 'False') {
            opt.label = '错误'
            opt.content = ''
          }
        })
      }
  
        return {
          id: item.No || index,
          type: type,
          title: item.question,
          options: options,
          correctAnswer: item.answer, // 可能是字符串或数组
          analysis: item.explanation
        }
      })
  
      if (questionList.length > 0) {
        this.setData({
          questionList,
          totalCount: questionList.length,
          currentQuestion: questionList[0]
        })
      }
    } else {
      wx.showToast({
        title: '该科目题库暂未上线',
        icon: 'none'
      })
    }
  },

  // 选择选项
  selectOption(e) {
    if (this.data.showAnswer) return

    const id = e.currentTarget.dataset.id
    const type = this.data.currentQuestion.type
    let options = this.data.currentQuestion.options
    let userAnswer = this.data.userAnswer

    if (type === 2) { // 多选题
      // 初始化 userAnswer 为数组
      if (!Array.isArray(userAnswer)) userAnswer = []
      
      const index = userAnswer.indexOf(id)
      if (index > -1) {
        userAnswer.splice(index, 1) // 取消选中
      } else {
        userAnswer.push(id) // 选中
      }
      userAnswer.sort() // 排序以便比较

      // 更新 options 选中状态
      options = options.map(opt => ({
        ...opt,
        selected: userAnswer.includes(opt.id)
      }))
    } else { // 单选或判断
      userAnswer = id
      options = options.map(opt => ({
        ...opt,
        selected: opt.id === id
      }))
    }

    this.setData({
      'currentQuestion.options': options,
      userAnswer
    })
  },

  // 查看/提交答案
  toggleAnswer() {
    const { userAnswer, currentQuestion } = this.data
    
    if (!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0)) {
      wx.showToast({
        title: '请先选择答案',
        icon: 'none'
      })
      return
    }

    let isCorrect = false
    if (Array.isArray(currentQuestion.correctAnswer)) {
      // 多选题比较数组
      if (Array.isArray(userAnswer) && 
          userAnswer.length === currentQuestion.correctAnswer.length &&
          userAnswer.every((val, index) => val === currentQuestion.correctAnswer[index])) { // 假设都已排序
        isCorrect = true
      }
    } else {
      // 单选比较字符串
      isCorrect = userAnswer === currentQuestion.correctAnswer
    }

    // 标记正确答案选项
    const options = currentQuestion.options.map(opt => {
      let isOptCorrect = false
      if (Array.isArray(currentQuestion.correctAnswer)) {
        isOptCorrect = currentQuestion.correctAnswer.includes(opt.id)
      } else {
        isOptCorrect = currentQuestion.correctAnswer === opt.id
      }
      return {
        ...opt,
        isCorrect: isOptCorrect
      }
    })

    this.setData({
      showAnswer: true,
      isCorrect,
      'currentQuestion.options': options
    })

    // 提交到云端
    this.submitToCloud(isCorrect)
  },

  // 提交答案到云端
  submitToCloud(isCorrect) {
    const { currentQuestion, userAnswer, currentIndex } = this.data
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'submitAnswer',
        subjectId: this.subjectId,
        questionId: String(currentQuestion.id),
        isCorrect,
        myAnswer: userAnswer,
        currentIndex
      },
      success: res => {
        console.log('答案提交成功', res)
      },
      fail: err => {
        console.error('答案提交失败', err)
      }
    })
  },

  // 切换收藏
  toggleFavorite() {
    const isFavorite = !this.data.isFavorite
    this.setData({
      isFavorite
    })
    
    // 更新本地题目列表中的状态
    const { currentIndex, questionList, currentQuestion } = this.data
    const newQuestionList = [...questionList]
    newQuestionList[currentIndex].isFavorite = isFavorite
    this.setData({
      questionList: newQuestionList
    })

    wx.showToast({
      title: isFavorite ? '收藏成功' : '取消收藏',
      icon: 'none'
    })

    // 提交到云端
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'toggleFavorite',
        subjectId: this.subjectId,
        questionId: String(currentQuestion.id),
        isFavorite
      },
      fail: err => {
        console.error('收藏操作失败', err)
        // 回滚状态
        this.setData({ isFavorite: !isFavorite })
        newQuestionList[currentIndex].isFavorite = !isFavorite
        this.setData({
           questionList: newQuestionList
        })
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        })
      }
    })
  },

  // 下一题
  nextQuestion() {
    if (this.data.currentIndex < this.data.totalCount - 1) {
      const newIndex = this.data.currentIndex + 1
      this.switchQuestion(newIndex)
    } else {
      wx.navigateBack()
    }
  },

  // 显示答题卡
  showCard() {
    wx.showToast({
      title: '答题卡功能开发中',
      icon: 'none'
    })
  }
})
