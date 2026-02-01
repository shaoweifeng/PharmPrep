// pages/chapter-select/chapter-select.js
Page({
  data: {
    subjectId: '',
    subjectName: '',
    textbookList: [],
    textbookIndex: 0,
    chapterList: [],
    chapterIndex: 0,
    questionList: [],
    loading: false,
    page: 1,
    pageSize: 20,
    isOver: false,
    total: 0
  },

  onLoad(options) {
    const { subjectId, subjectName } = options
    this.setData({
      subjectId,
      subjectName
    })
    
    this.loadTextbooks()
  },

  // 加载教材列表
  loadTextbooks() {
    wx.showLoading({ title: '加载教材...' })
    wx.cloud.callFunction({
      name: 'get_questions',
      data: {
        action: 'getTextbooks',
        subject: this.data.subjectName
      },
      success: res => {
        wx.hideLoading()
        if (res.result.code === 0) {
          const textbookList = res.result.data
          this.setData({
            textbookList,
            textbookIndex: 0
          })
          
          if (textbookList.length > 0) {
            this.loadChapters(textbookList[0])
          }
        } else {
          wx.showToast({ title: '加载教材失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error(err)
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  // 加载章节列表
  loadChapters(textbook) {
    wx.showLoading({ title: '加载章节...' })
    wx.cloud.callFunction({
      name: 'get_questions',
      data: {
        action: 'getChapters',
        subject: this.data.subjectName,
        textbook: textbook
      },
      success: res => {
        wx.hideLoading()
        if (res.result.code === 0) {
          const chapterList = res.result.data
          this.setData({
            chapterList,
            chapterIndex: 0,
            page: 1,
            questionList: [],
            isOver: false
          })
          
          if (chapterList.length > 0) {
            this.loadQuestions()
          }
        } else {
          wx.showToast({ title: '加载章节失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error(err)
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  // 加载题目列表
  loadQuestions(append = false) {
    if (this.data.loading) return
    if (!append && this.data.isOver) this.setData({ isOver: false }) // Reset if reloading

    this.setData({ loading: true })
    
    const { subjectName, textbookList, textbookIndex, chapterList, chapterIndex, page, pageSize } = this.data
    const textbook = textbookList[textbookIndex]
    const chapter = chapterList[chapterIndex]

    if (!textbook || !chapter) {
      this.setData({ loading: false })
      return
    }

    wx.cloud.callFunction({
      name: 'get_questions',
      data: {
        action: 'getQuestions',
        subject: subjectName,
        textbook: textbook,
        chapter: chapter,
        page: page,
        pageSize: pageSize,
        usePagination: true
      },
      success: res => {
        if (res.result.code === 0) {
          const newQuestions = res.result.data
          const total = res.result.total
          const currentList = append ? this.data.questionList : []
          const list = currentList.concat(newQuestions)
          
          this.setData({
            questionList: list,
            total,
            isOver: list.length >= total,
            loading: false
          })
        } else {
          wx.showToast({ title: '加载题目失败', icon: 'none' })
          this.setData({ loading: false })
        }
      },
      fail: err => {
        console.error(err)
        wx.showToast({ title: '网络错误', icon: 'none' })
        this.setData({ loading: false })
      }
    })
  },

  // 切换教材
  onTextbookChange(e) {
    const index = e.detail.value
    this.setData({ textbookIndex: index })
    const textbook = this.data.textbookList[index]
    this.loadChapters(textbook)
  },

  // 切换章节
  onChapterChange(e) {
    const index = e.detail.value
    this.setData({ 
      chapterIndex: index,
      page: 1,
      questionList: [],
      isOver: false
    })
    this.loadQuestions()
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.isOver && !this.data.loading) {
      this.setData({
        page: this.data.page + 1
      }, () => {
        this.loadQuestions(true)
      })
    }
  },

  // 点击题目
  onQuestionTap(e) {
    const index = e.currentTarget.dataset.index
    // 携带筛选条件和起始索引跳转
    this.navigateToExercise(index)
  },

  // 开始刷题（默认从第一题开始）
  onStartPractice() {
    if (this.data.questionList.length === 0) {
      wx.showToast({ title: '当前无题目', icon: 'none' })
      return
    }
    this.navigateToExercise(0)
  },

  // 返回
  onBack() {
    wx.navigateBack()
  },

  // 统一跳转逻辑
  navigateToExercise(startIndex) {
    const { subjectId, subjectName, textbookList, textbookIndex, chapterList, chapterIndex } = this.data
    const textbook = textbookList[textbookIndex]
    const chapter = chapterList[chapterIndex]
    
    // 我们传递筛选条件，让 exerciseDetail 页面根据条件重新加载（或者我们可以传递当前已加载的列表，但列表可能不全）
    // 最佳实践是传递筛选条件，exerciseDetail 负责加载（全量或分页）。
    // 考虑到 exerciseDetail 目前是全量加载，我们传递 filter，让它去加载。
    // 还需要传递 startIndex，以便定位。
    
    wx.navigateTo({
      url: `/pages/exercise/exerciseDetail?subjectId=${subjectId}&subjectName=${subjectName}&textbook=${textbook}&chapter=${chapter}&startIndex=${startIndex}`
    })
  }
})
