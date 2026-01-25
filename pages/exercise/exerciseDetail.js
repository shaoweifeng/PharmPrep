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
    }
  },

  onLoad(options) {
    const { subjectId, subjectName } = options
    this.subjectId = subjectId // 保存到实例变量
    
    if (subjectName) {
      wx.setNavigationBarTitle({
        title: subjectName + '练习'
      })
    }
    
    // 1. 先加载题目
    this.loadQuestions(subjectId)

    // 2. 再加载云端进度
    this.loadCloudProgress(subjectId)
  },

  // 加载云端进度
  loadCloudProgress(subjectId) {
    wx.showLoading({ title: '同步进度中...' })
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'getSubjectDetail',
        subjectId
      },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          const { lastIndex, answers, favoriteIds, mistakeIds } = res.result.data
          
          // 恢复做题进度（跳转到上次做的题目）
          let targetIndex = lastIndex
          if (targetIndex >= this.data.totalCount) targetIndex = this.data.totalCount - 1
          if (targetIndex < 0) targetIndex = 0

          // 更新题目列表中的状态（收藏、是否做过）
          // 注意：如果题目量特别大，这里需要优化，避免遍历整个列表
          const newQuestionList = this.data.questionList.map(q => {
            const answerRecord = answers[q.id] // q.id 是 "1", "2" 这样的字符串
            const isFav = favoriteIds.includes(String(q.id)) // 确保类型一致
            
            // 如果做过，可以预填充（可选，视需求而定。通常刷题模式下，做过的题再次进入可以重做，或者显示上次答案）
            // 这里暂且只标记收藏状态，不恢复已填答案，以免影响重刷体验。
            // 但如果是“继续做题”，则应恢复现场。
            // 鉴于这是“刷题”应用，通常用户希望继续做未做的题，或者查看已做的题。
            // 简单起见，我们只恢复收藏状态，并跳转到 lastIndex。
            
            // 修正：如果这道题正好是当前显示的题，需要更新 currentQuestion 的 isFavorite
            return {
              ...q,
              isFavorite: isFav
            }
          })

          this.setData({
            questionList: newQuestionList,
            currentIndex: targetIndex,
            currentQuestion: newQuestionList[targetIndex],
            isFavorite: newQuestionList[targetIndex].isFavorite || false
          })
        }
      },
      fail: err => {
        wx.hideLoading()
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

  // 切换到下一题
  nextQuestion() {
    if (this.data.currentIndex < this.data.totalCount - 1) {
      const nextIndex = this.data.currentIndex + 1
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: this.data.questionList[nextIndex],
        showAnswer: false,
        userAnswer: this.data.questionList[nextIndex].type === 2 ? [] : '',
        isCorrect: false
      })
    } else {
      wx.navigateBack()
    }
  },

  // 上一题
  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const prevIndex = this.data.currentIndex - 1
      // 恢复上一题状态（这里简化为重置，若需保留状态需存储在 questionList 中）
      this.setData({
        currentIndex: prevIndex,
        currentQuestion: this.data.questionList[prevIndex],
        showAnswer: false,
        userAnswer: this.data.questionList[prevIndex].type === 2 ? [] : '',
        isCorrect: false
      })
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
