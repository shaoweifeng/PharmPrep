// pages/exercise/exercise.js
Page({
  data: {
    subjectList: [
      {
        id: 1,
        name: '药理学',
        icon: '💊',
        count: 1200
      },
      {
        id: 2,
        name: '药剂学',
        icon: '🧪',
        count: 1000
      },
      {
        id: 3,
        name: '药物化学',
        icon: '⚗️',
        count: 950
      },
      {
        id: 4,
        name: '药物分析',
        icon: '🔬',
        count: 900
      },
      {
        id: 5,
        name: '天然药物化学',
        icon: '🌿',
        count: 850
      },
      {
        id: 6,
        name: '药事管理',
        icon: '📋',
        count: 700
      }
    ],
    recentList: [
      {
        id: 1,
        subject: '药理学',
        time: '2024-01-15 14:30',
        correct: 8,
        score: 80
      },
      {
        id: 2,
        subject: '药剂学',
        time: '2024-01-14 19:45',
        correct: 7,
        score: 70
      }
    ]
  },

  onShow() {
    this.loadProgress()
  },

  // 加载云端进度
  loadProgress() {
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'getSubjectList'
      },
      success: res => {
        if (res.result && res.result.code === 0) {
          const progressMap = res.result.data || {}
          
          const newSubjectList = this.data.subjectList.map(item => {
            const progress = progressMap[item.id]
            if (progress) {
              return {
                ...item,
                totalAnswered: progress.totalAnswered || 0,
                correctCount: progress.correctCount || 0,
                accuracy: progress.totalAnswered ? Math.round((progress.correctCount / progress.totalAnswered) * 100) : 0
              }
            }
            return item
          })

          this.setData({
            subjectList: newSubjectList
          })
        }
      },
      fail: err => {
        console.error('获取进度失败', err)
      }
    })
  },

  onLoad() {
    // 页面加载时可以从本地缓存或云数据库获取最近练习记录
    this.loadRecentPractice()
  },

  // 加载最近练习记录
  loadRecentPractice() {
    const recentList = wx.getStorageSync('recentPractice') || []
    if (recentList.length > 0) {
      this.setData({
        recentList
      })
    }
  },

  // 选择科目
  selectSubject(e) {
    const subjectId = e.currentTarget.dataset.subjectId
    const subject = this.data.subjectList.find(s => s.id === subjectId)
    
    // 跳转到教材和章节选择页面
    wx.navigateTo({
      url: `/pages/chapter-select/chapter-select?subjectId=${subjectId}&subjectName=${subject.name}`
    })
  },

  // 选择练习模式
  selectMode(e) {
    const mode = e.currentTarget.dataset.mode
    
    // 这里可以根据选择的模式跳转到对应的练习页面
    wx.showToast({
      title: `选择了${this.getModeName(mode)}模式`,
      icon: 'none'
    })
  },

  // 获取模式名称
  getModeName(mode) {
    const modeMap = {
      random: '随机练习',
      chapter: '章节练习',
      wrong: '错题重练',
      simulate: '模拟考试'
    }
    return modeMap[mode] || mode
  }
})