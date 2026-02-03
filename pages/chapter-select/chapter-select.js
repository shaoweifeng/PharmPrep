// pages/chapter-select/chapter-select.js
const chnToNum = (chnStr) => {
  const chnNumChar = { '零':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 }
  const chnNameValue = { 
    '十': { value: 10, secUnit: false },
    '百': { value: 100, secUnit: false },
    '千': { value: 1000, secUnit: false },
    '万': { value: 10000, secUnit: true },
    '亿': { value: 100000000, secUnit: true }
  }
  let rtn = 0, section = 0, number = 0, secUnit = false
  const str = chnStr.split('')
  for(let i = 0; i < str.length; i++){
    let num = chnNumChar[str[i]]
    if(typeof num !== 'undefined'){
      number = num
    } else {
      let unitNode = chnNameValue[str[i]]
      if(typeof unitNode !== 'undefined'){
        let unit = unitNode.value
        secUnit = unitNode.secUnit
        if(secUnit){
          section = (section + number) * unit
          rtn += section
          section = 0
        } else {
          if (number === 0 && unit === 10) number = 1
          section += (number * unit)
        }
        number = 0
      }
    }
  }
  return rtn + section + number
}

Page({
  data: {
    subjectId: '',
    subjectName: '',
    textbookList: [],
    textbookIndex: 0,
    
    // 章节相关
    rawChapterList: [], // 包含 {name, count} 的原始列表
    chapterNames: ['全部章节'], // 供 picker 使用的名称列表，初始化默认值
    chapterIndex: 0, // 0 代表 "全部章节"
    
    // 视图状态
    isAllChapters: true, // 是否显示章节列表视图
    
    // 列表数据
    displayChapterList: [], // 章节列表视图的数据（带进度）
    questionList: [], // 题目列表视图的数据
    
    // 分页状态
    loading: false,
    page: 1,
    pageSize: 20,
    isOver: false,
    total: 0,
    
    // 用户进度
    userProgressMap: {} // { chapterNum: count }
  },

  onLoad(options) {
    const { subjectId, subjectName } = options
    this.setData({
      subjectId,
      subjectName
    })
    
    this.loadUserProgress()
    this.loadTextbooks()
  },

  onShow() {
    // 每次显示页面时刷新进度（如果在刷题页做了题）
    if (this.data.subjectId) {
      this.loadUserProgress()
    }
  },

  // 加载用户进度
  loadUserProgress() {
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'getSubjectDetail',
        subjectId: this.data.subjectId
      },
      success: res => {
        if (res.result.code === 0 && res.result.data) {
          const answers = res.result.data.answers || {}
          this.processUserProgress(answers)
        }
      }
    })
  },

  // 处理用户进度，统计每章完成数
  processUserProgress(answers) {
    const progressMap = {}
    Object.keys(answers).forEach(qid => {
      // ID 格式: resource_chapterNum_No
      // 例如: ylx_xxzd_01_001
      const parts = qid.split('_')
      if (parts.length >= 3) {
        // 取倒数第二个部分作为章节号 (假设格式总是 resource_..._chapter_no)
        // 更稳健的方式是取 parts[parts.length - 2]
        const chapterNumStr = parts[parts.length - 2]
        const chapterNum = parseInt(chapterNumStr, 10)
        if (!isNaN(chapterNum)) {
          progressMap[chapterNum] = (progressMap[chapterNum] || 0) + 1
        }
      }
    })
    
    this.setData({ userProgressMap: progressMap })
    
    // 如果当前显示的是章节列表，需要更新列表显示
    if (this.data.isAllChapters && this.data.rawChapterList.length > 0) {
      this.updateDisplayChapterList()
    }
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
          } else {
            wx.showModal({
              title: '暂无题库',
              content: '未检测到题库数据，请前往“个人中心-题库导入”进行初始化。',
              confirmText: '去导入',
              showCancel: true,
              success: (res) => {
                if (res.confirm) {
                  wx.switchTab({
                    url: '/pages/me/me'
                  })
                }
              }
            })
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
          const rawChapterList = res.result.data || [] // 确保是数组
          
          // 构建 Picker 用的名称列表，首项为 "全部章节"
          // 过滤掉没有 name 的无效项
          const validChapters = rawChapterList.filter(i => i && typeof i.name === 'string')
          const chapterNames = ['全部章节', ...validChapters.map(i => i.name)]
          
          console.log('Loaded chapters:', chapterNames) // Debug log

          this.setData({
            rawChapterList: validChapters,
            chapterNames,
            chapterIndex: 0, // 默认选中全部
            isAllChapters: true
          }, () => {
            // 在 setData 回调中调用，确保 rawChapterList 已更新
            this.updateDisplayChapterList()
          })
        } else {
          // 即使失败，也要重置章节列表，避免卡死
          this.setData({
            chapterNames: ['全部章节'],
            rawChapterList: [],
            isAllChapters: true
          })
          wx.showToast({ title: '加载章节失败', icon: 'none' })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error(err)
        // 网络错误也要重置
        this.setData({
          chapterNames: ['全部章节'],
          rawChapterList: [],
          isAllChapters: true
        })
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  // 更新章节列表显示数据
  updateDisplayChapterList() {
    const { rawChapterList, userProgressMap } = this.data
    
    if (!rawChapterList || !Array.isArray(rawChapterList)) return

    const displayList = rawChapterList.map(item => {
      // 防御性检查
      if (!item || typeof item.name !== 'string') {
        return null
      }

      // 从章节名称中提取数字
      const match = item.name.match(/第(.+)章/)
      let chapterNum = 0
      if (match) {
        chapterNum = chnToNum(match[1])
      }
      
      const finished = userProgressMap[chapterNum] || 0
      return {
        name: item.name,
        total: item.count,
        finished: finished > item.count ? item.count : finished, // 防御性编程
        _id: item.name // 使用名称作为 key
      }
    }).filter(item => item !== null)
    
    this.setData({
      displayChapterList: displayList
    })
  },

  onTextbookChange(e) {
    const index = parseInt(e.detail.value)
    if (index !== this.data.textbookIndex) {
      this.setData({ textbookIndex: index })
      this.loadChapters(this.data.textbookList[index])
    }
  },

  onChapterChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({ chapterIndex: index })
    
    if (index === 0) {
      // 选择了 "全部章节"
      this.setData({ isAllChapters: true }, () => {
        this.updateDisplayChapterList()
      })
    } else {
      // 选择了具体章节
      this.setData({ 
        isAllChapters: false,
        page: 1,
        questionList: [],
        isOver: false
      })
      this.loadQuestions()
    }
  },

  // 加载题目列表
  loadQuestions(append = false) {
    if (this.data.loading) return
    
    // 如果是 "全部章节" 模式，不需要加载题目（或者加载全部题目？需求是显示章节列表）
    // 但如果用户想看全部题目呢？
    // 需求说："章节下拉菜单默认选择为所有，下面的具体题目列表改为显示所有章节列表"
    // 所以 "全部章节" 模式下显示章节列表。
    // 如果选择了具体章节，才显示题目。
    if (this.data.isAllChapters) return

    this.setData({ loading: true })
    
    // chapterIndex 0 是全部，所以实际章节在 rawChapterList 中的索引是 index - 1
    const chapterName = this.data.rawChapterList[this.data.chapterIndex - 1].name
    
    wx.cloud.callFunction({
      name: 'get_questions',
      data: {
        action: 'getQuestions',
        subject: this.data.subjectName,
        textbook: this.data.textbookList[this.data.textbookIndex],
        chapter: chapterName,
        page: this.data.page,
        pageSize: this.data.pageSize,
        usePagination: true
      },
      success: res => {
        if (res.result.code === 0) {
          const newQuestions = res.result.data
          const total = res.result.total
          
          this.setData({
            questionList: append ? this.data.questionList.concat(newQuestions) : newQuestions,
            loading: false,
            total,
            isOver: (append ? this.data.questionList.length : 0) + newQuestions.length >= total
          })
        } else {
          this.setData({ loading: false })
          wx.showToast({ title: '加载题目失败', icon: 'none' })
        }
      },
      fail: err => {
        this.setData({ loading: false })
        console.error(err)
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  onLoadMore() {
    if (!this.data.isOver && !this.data.loading && !this.data.isAllChapters) {
      this.setData({ page: this.data.page + 1 })
      this.loadQuestions(true)
    }
  },

  // 点击具体的题目（在题目列表视图中）
  onQuestionTap(e) {
    const index = e.currentTarget.dataset.index
    this.navigateToExercise(index)
  },

  // 点击章节列表中的某一项
  onChapterTap(e) {
    const index = e.currentTarget.dataset.index // 在 rawChapterList 中的索引
    // 切换到该章节的题目列表视图
    // 对应的 picker index 是 index + 1
    console.log("index+1 = ", index + 1)
    this.setData({
      chapterIndex: index + 1,
      isAllChapters: false,
      page: 1,
      questionList: [],
      isOver: false
    })
    this.loadQuestions()
  },

  onStartPractice() {
    // 如果是全部章节视图，从第一章第一题开始？
    // 或者从当前教材第一题开始
    if (this.data.isAllChapters) {
      // 获取第一章名称
      if (this.data.rawChapterList.length > 0) {
        const firstChapter = this.data.rawChapterList[0].name
        const textbook = this.data.textbookList[this.data.textbookIndex]
        
        wx.navigateTo({
          url: `/pages/exercise/exerciseDetail?subjectId=${this.data.subjectId}&subjectName=${this.data.subjectName}&textbook=${textbook}&chapter=${firstChapter}&startIndex=0`
        })
      }
    } else {
      // 也就是题目列表视图，从第一题开始
      this.navigateToExercise(0)
    }
  },

  navigateToExercise(startIndex) {
    const textbook = this.data.textbookList[this.data.textbookIndex]
    // 这里的 chapter 必须是具体的章节名
    const chapter = this.data.rawChapterList[this.data.chapterIndex - 1].name
    
    wx.navigateTo({
      url: `/pages/exercise/exerciseDetail?subjectId=${this.data.subjectId}&subjectName=${this.data.subjectName}&textbook=${textbook}&chapter=${chapter}&startIndex=${startIndex}`
    })
  },

  onBack() {
    // 如果在具体章节视图，点击返回可以回到章节列表视图（这是一个好的交互优化）
    if (!this.data.isAllChapters) {
      this.setData({
        isAllChapters: true,
        chapterIndex: 0
      }, () => {
        this.updateDisplayChapterList()
      })
    } else {
      wx.navigateBack()
    }
  }
})
