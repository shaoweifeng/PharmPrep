// pages/index/index.js
Page({
  data: {
    countdown: {
      days: 0
    },
    bannerList: [
      {
        id: 1,
        imageUrl: '',
        link: 'cloud://pharm-prep-2g3a9oq5b57fa359.7068-pharm-prep-2g3a9oq5b57fa359-1329430978/images/banners/banner1.png'
      },
      {
        id: 2,
        imageUrl: '',
        link: 'cloud://pharm-prep-2g3a9oq5b57fa359.7068-pharm-prep-2g3a9oq5b57fa359-1329430978/images/banners/banner2.png'
      },
      {
        id: 3,
        imageUrl: '',
        link: 'cloud://pharm-prep-2g3a9oq5b57fa359.7068-pharm-prep-2g3a9oq5b57fa359-1329430978/images/banners/banner3.png'
      }
    ],
    recommendList: [
      {
        id: 1,
        title: '药理学高频考点速记',
        desc: '涵盖考研药理学核心考点，助你快速记忆',
        tag: '知识点速记',
        imageUrl: '/images/recomands/recomand1.png'
      },
      {
        id: 2,
        title: '药剂学大题必背50题',
        desc: '精选药剂学常考大题，附带详细解析',
        tag: '大题带背',
        imageUrl: '/images/recomands/recomand2.png'
      }
    ],
    timer: null
  },

  onLoad() {
    // 初始化倒计时
    this.initCountdown()
    // 仅针对轮播图：使用 link 作为云文件ID加载临时链接
    this.bannerFileIDs = (this.data.bannerList || []).map(item => String(item.link || '').trim())
    // 首帧不渲染 cloud://，先清空 imageUrl，待获取临时链接后再填充
    this.setData({
      bannerList: (this.data.bannerList || []).map(item => ({ ...item, imageUrl: '' }))
    })
    this.loadBannerImages()
  },

  onShow() {
    // 页面显示时启动倒计时
    this.startCountdown()
  },

  onHide() {
    // 页面隐藏时清除倒计时
    this.clearCountdown()
  },

  onUnload() {
    // 页面卸载时清除倒计时
    this.clearCountdown()
  },

  // 初始化倒计时
  initCountdown() {
    const app = getApp()
    const examDate = app.globalData.examDate
    this.calculateCountdown(examDate)
  },

  // 计算倒计时 - 只精确到天
  calculateCountdown(examDate) {
    const parseDate = (str) => {
      if (!str) return null
      const parts = str.split('-')
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10) - 1
        const d = parseInt(parts[2], 10)
        return new Date(y, m, d, 0, 0, 0, 0)
      }
      return null
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const exam = parseDate(examDate) || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const diff = exam.getTime() - now.getTime()
    let days = 0

    if (diff > 0) {
      days = Math.floor(diff / (1000 * 60 * 60 * 24))
    }

    this.setData({
      countdown: {
        days
      }
    })
  },

  // 仅轮播图：从 link（cloud 文件ID）换取临时 HTTPS 链接并填充到 imageUrl
  loadBannerImages() {
    const fileList = (this.bannerFileIDs || []).filter(id => typeof id === 'string' && id.startsWith('cloud://'))
    if (fileList.length === 0) return

    wx.cloud.getTempFileURL({
      fileList,
      success: res => {
        console.info("res.fileList", res.fileList)
        // 直接使用 map 生成新列表，简化逻辑
        const newBannerList = (this.data.bannerList || []).map((item, idx) => {
          const fileID = this.bannerFileIDs[idx]
          // 在结果中找到对应的 fileID
          const fileItem = res.fileList.find(i => i.fileID === fileID)
          
          if (fileItem && fileItem.status === 0) {
            console.info(`图片加载成功: ${fileID}`)
            return { ...item, imageUrl: fileItem.tempFileURL }
          } else {
            console.warn(`图片加载失败或状态异常: ${fileID}`, fileItem)
            return item
          }
        })
        
        this.setData({ bannerList: newBannerList })
        console.info("更新后的 bannerList:", newBannerList)
      },
      fail: err => {
        console.error('轮播图云图片加载失败', err)
      }
    })
  },

  // 启动倒计时 - 每天更新一次
  startCountdown() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
    }

    // 立即计算一次
    const app = getApp()
    this.calculateCountdown(app.globalData && app.globalData.examDate)
    
    // 每天更新一次（86400000毫秒 = 24小时）
    const timer = setInterval(() => {
      this.calculateCountdown(app.globalData && app.globalData.examDate)
    }, 86400000)

    this.setData({
      timer
    })
  },

  // 清除倒计时
  clearCountdown() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
      this.setData({
        timer: null
      })
    }
  },

  // 轮播图点击事件
  onBannerTap(e) {
    const bannerId = e.currentTarget.dataset.bannerId
    console.log('点击了轮播图：', bannerId)
    // 可以根据bannerId跳转到对应的广告页面
  },

  // 导航到习题选择速刷
  navigateToExercise() {
    wx.navigateTo({
      url: '/pages/exercise/exercise'
    })
  },

  // 导航到习题大题带背
  navigateToEssay() {
    wx.navigateTo({
      url: '/pages/essay/essay'
    })
  },

  // 导航到高校真题合集
  navigateToTrueExam() {
    wx.navigateTo({
      url: '/pages/trueExam/trueExam'
    })
  },

  // 导航到知识点速记
  navigateToKnowledge() {
    wx.navigateTo({
      url: '/pages/knowledge/knowledge'
    })
  },

  // 导航到Anki卡片
  navigateToAnki() {
    wx.navigateTo({
      url: '/pages/anki/anki'
    })
  },

  // 导航到名词解释带背
  navigateToTerm() {
    wx.navigateTo({
      url: '/pages/term/term'
    })
  }
})
