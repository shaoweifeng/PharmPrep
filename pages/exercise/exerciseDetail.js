// pages/exercise/exerciseDetail.js

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
    const { subjectId, subjectName, mode, listIndex, type, textbook, chapter, startIndex } = options
    this.subjectId = subjectId // 保存到实例变量
    this.mode = mode || 'practice' // practice, review
    this.textbook = textbook || ''
    this.chapter = chapter || ''
    this.explicitStartIndex = startIndex ? parseInt(startIndex) : null
    
    this.setData({ reviewType: type || '' })

    if (subjectName) {
      this.subjectName = subjectName
      wx.setNavigationBarTitle({
        title: subjectName + (mode === 'review' ? '详情' : '练习')
      })
    }
    
    if (this.mode === 'review') {
      // 回顾模式下，题目列表来自于上个页面的传递
      const reviewList = wx.getStorageSync('reviewList') || []
      this.reviewList = reviewList // 保存原始记录列表
      this.loadReviewQuestions(reviewList, listIndex)
      // 回顾模式下，由于 loadReviewQuestions 是异步的，
      // loadCloudProgress 可能会在 questionList 为空时执行，导致 undefined 错误
      // 所以应该在 loadReviewQuestions 获取到题目后，再调用 loadCloudProgress
      // 这里先移除调用，改为在 loadReviewQuestions 成功后调用
    } else {
      // 练习模式：先加载题目，题目加载成功后再同步进度
      // 因为 loadQuestions 是异步的，如果直接并行调用 loadCloudProgress
      // 此时 questionList 可能还为空，导致 newQuestionList[targetIndex] 报错
      // 解决方案：让 loadQuestions 返回 Promise 或者在 success 回调中调用 loadCloudProgress
      this.loadQuestions(subjectId)
    }
  },

  // 处理云端题目数据格式
  processCloudQuestions(rawQuestions) {
    return rawQuestions.map((item) => {
      let type = 1
      if (item.type === 'multiple_choice') type = 2
      if (item.type === 'true_false') type = 3

      const options = []
      // 兼容 options 和 choice 字段，防止 undefined 报错
      const rawOptions = item.options || item.choice || {}
      const keys = Object.keys(rawOptions).sort()
      keys.forEach(key => {
        options.push({
          id: key,
          label: key,
          content: rawOptions[key],
          selected: false
        })
      })

      if (type === 3) {
        options.forEach(opt => {
          if (opt.id === 'True') { opt.label = '正确'; opt.content = '' }
          if (opt.id === 'False') { opt.label = '错误'; opt.content = '' }
        })
      }

      return {
        id: item._id,
        type: type,
        title: item.question,
        options: options,
        correctAnswer: item.answer, // 可能是字符串或数组
        analysis: item.explanation
      }
    })
  },

  // 加载回顾模式的题目列表
  loadReviewQuestions(reviewList, initialListIndex) {
    const ids = Array.from(new Set(reviewList.map(item => item.questionId))).filter(id => id)
    if (ids.length === 0) return

    wx.showLoading({ title: '加载题目...' })
    wx.cloud.callFunction({
      name: 'get_questions',
      data: { ids },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          const cloudQuestions = res.result.data
          const questionList = reviewList.map(item => {
            const qData = cloudQuestions.find(q => q._id === item.questionId)
            if (!qData) return null

            // 格式化为详情页需要的结构
            const formatted = this.processCloudQuestions([qData])[0]

            // 回显用户答案和正确答案
            let userAnswer = item.myAnswer || ''
            
            // 计算是否正确
            let isCorrect = false
            if (Array.isArray(formatted.correctAnswer)) {
              if (Array.isArray(userAnswer) && 
                  userAnswer.length === formatted.correctAnswer.length &&
                  userAnswer.every((val, i) => val === formatted.correctAnswer[i])) {
                isCorrect = true
              }
            } else {
              isCorrect = userAnswer === formatted.correctAnswer
            }

            // 标记选项
            const markedOptions = formatted.options.map(opt => {
              let isOptCorrect = false
              if (Array.isArray(formatted.correctAnswer)) {
                isOptCorrect = formatted.correctAnswer.includes(opt.id)
              } else {
                isOptCorrect = formatted.correctAnswer === opt.id
              }
              
              let isSelected = false
              if (Array.isArray(userAnswer)) {
                isSelected = userAnswer.includes(opt.id)
              } else {
                isSelected = userAnswer === opt.id
              }

              return Object.assign({}, opt, {
                isCorrect: isOptCorrect,
                selected: isSelected
              })
            })

            return Object.assign({}, formatted, {
              options: markedOptions,
              myAnswer: userAnswer,
              userIsCorrect: isCorrect,
              recordId: item._id
            })
          }).filter(q => q !== null)

          const currentIndex = parseInt(initialListIndex) || 0
          if (questionList.length > 0) {
            this.setData({
              questionList,
              totalCount: questionList.length,
              currentIndex,
              currentQuestion: questionList[currentIndex],
              showAnswer: true, // 回顾模式默认显示答案
              userAnswer: questionList[currentIndex].myAnswer,
              isCorrect: questionList[currentIndex].userIsCorrect,
              isFavorite: true 
            })
            // 加载当前题目的收藏状态
            this.loadCloudProgress(this.subjectId, false)
          } else {
            wx.showToast({ title: '题目加载失败', icon: 'none' })
          }
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error('加载题目失败', err)
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
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
            return Object.assign({}, q, {
              isFavorite: isFav
            })
          })

          const updateData = {
            questionList: newQuestionList
          }
          
          if (newQuestionList.length > 0 && targetIndex >= 0 && targetIndex < newQuestionList.length) {
              updateData.isFavorite = newQuestionList[targetIndex].isFavorite || false
              
              if (restoreProgress) {
                 updateData.currentIndex = targetIndex
                 updateData.currentQuestion = newQuestionList[targetIndex]
              } else {
                 // 如果不恢复进度（review模式），只需更新当前题目的收藏状态
                 const currentQ = this.data.currentQuestion
                 if (currentQ) {
                     const currentQInList = newQuestionList[this.data.currentIndex]
                     updateData.currentQuestion = Object.assign({}, currentQ, {
                       isFavorite: (currentQInList && currentQInList.isFavorite) || false
                     })
                 }
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
    wx.showLoading({ title: '加载题目中...' })
    const subject = this.subjectName || (subjectId === '1' ? '药理学' : '')
    
    if (!subject) {
      wx.hideLoading()
      wx.showToast({ title: '未知科目', icon: 'none' })
      return
    }

    const data = { subject }
    if (this.textbook) data.textbook = this.textbook
    if (this.chapter) data.chapter = this.chapter

    wx.cloud.callFunction({
      name: 'get_questions',
      data: data,
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          const rawQuestions = res.result.data
          const questionList = this.processCloudQuestions(rawQuestions)
          
          if (questionList.length > 0) {
            // 如果指定了起始题目，使用指定的索引
            let initialIndex = 0
            if (this.explicitStartIndex !== null && this.explicitStartIndex >= 0 && this.explicitStartIndex < questionList.length) {
                initialIndex = this.explicitStartIndex
            }

            this.setData({
              questionList,
              totalCount: questionList.length,
              currentQuestion: questionList[initialIndex],
              currentIndex: initialIndex
            })
            // 题目加载完成后，再同步云端进度
            // 如果有明确的起始题目，则不恢复进度（restoreProgress = false）
            const shouldRestore = this.explicitStartIndex === null
            this.loadCloudProgress(subjectId, shouldRestore)
          } else {
             wx.showToast({ title: '该科目暂无题目', icon: 'none' })
          }
        } else {
            wx.showToast({ title: '加载失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error(err)
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
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
      options = options.map(opt => Object.assign({}, opt, {
        selected: userAnswer.includes(opt.id)
      }))
    } else { // 单选或判断
      userAnswer = id
      options = options.map(opt => Object.assign({}, opt, {
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
      return Object.assign({}, opt, {
        isCorrect: isOptCorrect
      })
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
        // console.log('答案提交成功', res)
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
    const newQuestionList = questionList.concat([])
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
