// pages/record-list/record-list.js

Page({
  data: {
    type: 'favorite', // 'favorite' or 'mistake'
    list: []
  },

  onLoad(options) {
    const { type } = options
    if (type) {
      this.setData({ type })
      wx.setNavigationBarTitle({
        title: type === 'favorite' ? '我的收藏' : '我的错题'
      })
    }
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadData(callback) {
    wx.showLoading({ title: '加载列表...' })
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'getRecordList',
        type: this.data.type
      },
      success: res => {
        if (res.result && res.result.code === 0) {
          const rawList = res.result.data
          // 获取题目详细信息
          this.fetchQuestionDetails(rawList, callback)
        } else {
            wx.hideLoading()
            if (callback) callback()
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error('加载列表失败', err)
        if (callback) callback()
      }
    })
  },

  // 获取题目详情
  fetchQuestionDetails(rawList, callback) {
      if (rawList.length === 0) {
          this.setData({ list: [] })
          wx.hideLoading()
          if (callback) callback()
          return
      }

      const ids = [...new Set(rawList.map(item => item.questionId))]
      
      wx.cloud.callFunction({
          name: 'get_questions',
          data: { ids },
          success: res => {
              wx.hideLoading()
              if (res.result && res.result.code === 0) {
                  const questions = res.result.data
                  const processedList = rawList.map(item => {
                      const qData = questions.find(q => q._id === item.questionId)
                      // 如果找不到对应的题目（可能是旧数据或已被删除），则不显示或显示已失效
                      if (!qData) return null
                      
                      return {
                          ...item,
                          subjectName: qData.subject || '未知科目', // 从题目数据中获取科目
                          questionTitle: qData.question,
                          displayTime: this.formatTime(item.createTime)
                      }
                  }).filter(item => item !== null)
                  
                  this.setData({ list: processedList })
              }
              if (callback) callback()
          },
          fail: err => {
              wx.hideLoading()
              console.error('加载题目详情失败', err)
              if (callback) callback()
          }
      })
  },

  formatTime(timeStr) {
    if (!timeStr) return ''
    const date = new Date(timeStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  },

  onItemClick(e) {
    const item = e.currentTarget.dataset.item
    const { subjectId, questionId } = item
    
    // 获取当前列表中的所有题目 ID
    const idList = this.data.list.map(i => i.questionId)
    // 找到当前题目在列表中的索引
    const currentIndex = idList.indexOf(questionId)
    
    // 将列表存入 Storage，供 exerciseDetail 使用
    wx.setStorageSync('reviewList', this.data.list)
    
    // 传递必要的参数
    let url = `/pages/exercise/exerciseDetail?subjectId=${subjectId}&questionId=${questionId}&mode=review&listIndex=${currentIndex}&type=${this.data.type}`
    
    wx.navigateTo({ url })
  }
})
