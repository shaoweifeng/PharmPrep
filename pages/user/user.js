// pages/user/user.js
Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    totalQuestions: 0,
    correctQuestions: 0,
    accuracy: 0,
    studyDays: 0,
    showLoginModal: false,
    tempAvatarUrl: '',
    tempNickName: ''
  },

  onLoad() {
    // 检查是否支持 getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
    
    // 页面加载时获取用户信息和学习统计数据
    this.loadUserInfo()
    this.loadStudyStats()
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadUserInfo()
    this.loadStudyStats()
  },

  // 加载用户信息
  loadUserInfo() {
    // 从本地缓存获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo,
        hasUserInfo: true
      })
    }
  },

  // 获取用户信息（登录）
  getUserProfile(e) {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
        wx.setStorageSync('userInfo', res.userInfo)
      },
      fail: (err) => {
        console.error('获取用户信息失败', err)
      }
    })
  },

  // 点击用户信息区域
  onTapUserInfo() {
    if (!this.data.hasUserInfo) {
      this.setData({
        showLoginModal: true,
        tempAvatarUrl: '',
        tempNickName: ''
      })
    }
  },

  // 关闭登录弹窗
  closeLoginModal() {
    this.setData({
      showLoginModal: false
    })
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      tempAvatarUrl: avatarUrl
    })
  },

  // 昵称输入
  onNicknameChange(e) {
    this.setData({
      tempNickName: e.detail.value
    })
  },

  onNicknameInput(e) {
    this.setData({
      tempNickName: e.detail.value
    })
  },

  // 提交用户信息
  submitUserInfo() {
    const { tempAvatarUrl, tempNickName } = this.data
    if (!tempAvatarUrl || !tempNickName) {
      wx.showToast({
        title: '请完善头像和昵称',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '同步中...',
    })

    // 调用云函数登录/注册
    wx.cloud.callFunction({
      name: 'login',
      data: {
        avatarUrl: tempAvatarUrl,
        nickName: tempNickName
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          const userInfo = res.result.data
          
          this.setData({
            userInfo,
            hasUserInfo: true,
            showLoginModal: false,
            // 同时更新统计数据（如果云端返回了）
            totalQuestions: userInfo.totalQuestions || 0,
            correctQuestions: userInfo.correctQuestions || 0,
            studyDays: userInfo.studyDays || 0
          })
          
          // 更新正确率
          if (this.data.totalQuestions > 0) {
            const accuracy = Math.round((this.data.correctQuestions / this.data.totalQuestions) * 100)
            this.setData({ accuracy })
          }

          wx.setStorageSync('userInfo', userInfo)
          
          wx.showToast({
            title: '同步成功',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: '同步失败，请重试',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('云函数调用失败', err)
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        })
      }
    })
  },

  // 编辑用户资料
  editUserInfo() {
    // 复用登录弹窗逻辑
    const { userInfo, hasUserInfo } = this.data
    this.setData({
      showLoginModal: true,
      tempAvatarUrl: hasUserInfo ? userInfo.avatarUrl : '',
      tempNickName: hasUserInfo ? userInfo.nickName : ''
    })
  },
  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('userInfo')
          
          // 更新页面状态
          this.setData({
            userInfo: {},
            hasUserInfo: false
          })
          
          wx.showToast({
            title: '已退出登录',
            icon: 'none'
          })
        }
      }
    })
  },

  loadStudyStats() {
    // 这里可以从本地缓存或云数据库获取学习统计数据
    // 暂时使用模拟数据
    const totalQuestions = wx.getStorageSync('totalQuestions') || 0
    const correctQuestions = wx.getStorageSync('correctQuestions') || 0
    const studyDays = wx.getStorageSync('studyDays') || 0
    const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0

    this.setData({
      totalQuestions,
      correctQuestions,
      accuracy,
      studyDays
    })
  },

  // 导航到我的收藏
  navigateToCollection() {
    wx.showToast({
      title: '我的收藏功能开发中',
      icon: 'none'
    })
  },

  // 导航到我的错题
  navigateToWrong() {
    wx.showToast({
      title: '我的错题功能开发中',
      icon: 'none'
    })
  },

  // 导航到学习计划
  navigateToStudyPlan() {
    wx.showToast({
      title: '学习计划功能开发中',
      icon: 'none'
    })
  },

  // 导航到设置
  navigateToSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
    })
  },

  // 导航到关于我们
  navigateToAbout() {
    wx.showToast({
      title: '关于我们功能开发中',
      icon: 'none'
    })
  }
})
