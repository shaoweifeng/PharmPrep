// pages/record-list/record-list.js
// 引入题库数据 (目前只有药理学，后续有更多科目需要在这里引入并建立映射)
const pharmacologyData = require('../../data/questions/pharmacology.js')

Page({
  data: {
    type: 'favorite', // 'favorite' or 'mistake'
    list: [],
    subjectMap: {
      '1': { name: '药理学', data: pharmacologyData.prompt1_result },
      // 后续添加其他科目
    }
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
    wx.showLoading({ title: '加载中...' })
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'getRecordList',
        type: this.data.type
      },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          const rawList = res.result.data
          const processedList = this.processList(rawList)
          this.setData({ list: processedList })
        }
        if (callback) callback()
      },
      fail: err => {
        wx.hideLoading()
        console.error('加载列表失败', err)
        if (callback) callback()
      }
    })
  },

  // 处理列表数据，补充题目详情
  processList(list) {
    return list.map(item => {
      const { subjectId, questionId, createTime } = item
      const subject = this.data.subjectMap[subjectId]
      let questionTitle = '未知题目'
      
      if (subject && subject.data) {
        // 在题库中查找题目
        // 注意：questionId 在数据库存的是 string 还是 number？需要注意类型转换
        // 假设题库里的 No 是 number，数据库存的是 string，这里做宽松比较
        // 另外题库数据结构是 prompt1_result 数组
        // 这里假设 questionId 对应的是 index 或者是 No
        // 在 exerciseDetail.js 里看到 id: item.No || index
        // 我们需要一种可靠的方式找到题目。如果之前存的是 index，那直接取。
        // 如果存的是 item.No，则需要 find。
        // 为了保险，先尝试当 index 取，如果不对再遍历。
        // *重要*：在 exerciseDetail.js 里，id 是 item.No || index。
        // 最好在 exerciseDetail.js 里确认一下 id 的生成逻辑。
        // 假设 id 是可靠的唯一标识。
        
        // 尝试查找
        const qIndex = parseInt(questionId)
        if (!isNaN(qIndex) && subject.data[qIndex]) {
           const q = subject.data[qIndex]
           // 再次确认 id 是否匹配 (如果 id 是 No)
           // 如果 id 仅仅是 index，那直接取 title
           questionTitle = q.question
        } else {
          // 遍历查找 (如果 id 是 No)
          const found = subject.data.find((q, idx) => String(q.No || idx) === String(questionId))
          if (found) questionTitle = found.question
        }
      }

      return {
        ...item,
        subjectName: subject ? subject.name : '未知科目',
        questionTitle,
        displayTime: this.formatTime(createTime)
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
    
    // 构建跳转 URL
    // 将整个列表的 ID 序列传过去，太长可能会超出 URL 长度限制
    // 更好的方式是只传当前索引和 type，让详情页自己去云端拉取或者传参
    // 但详情页复用的是 exerciseDetail，它默认是加载整个题库。
    // 方案：将 idList 存入全局变量或 storage，详情页读取。
    
    wx.setStorageSync('reviewList', this.data.list)
    
    let url = `/pages/exercise/exerciseDetail?subjectId=${subjectId}&questionId=${questionId}&mode=review&listIndex=${currentIndex}`
    
    wx.navigateTo({ url })
  }
})
