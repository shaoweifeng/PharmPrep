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
    tempNickName: '',
    // 静态资源
    staticImages: {
      defaultAvatar: '',
      editIcon: ''
    }
  },

  onLoad() {
    const app = getApp()
    const cloudBase = app.globalData.cloudImageBase

    // 初始化云端静态资源
    this.initCloudImages(cloudBase)

    // 检查是否支持 getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
    
    // 页面加载时获取用户信息和学习统计数据
    this.loadUserInfo()
    if (this.data.hasUserInfo) {
      this.loadStudyStats()
    }
  },

  // 初始化并加载云端图片
  initCloudImages(cloudBase) {
    const staticImages = {
      defaultAvatar: `${cloudBase}/avatar/default.png`,
      editIcon: `${cloudBase}/icons/edit.png`
    }
    
    // 先存入 cloudFileID
    this.setData({ staticImages })
    
    // 换取临时链接
    const fileList = Object.values(staticImages)
    wx.cloud.getTempFileURL({
      fileList,
      success: res => {
        const urlMap = new Map()
        res.fileList.forEach(item => {
          if (item.status === 0) {
            urlMap.set(item.fileID, item.tempFileURL)
          }
        })
        
        this.setData({
          staticImages: {
            defaultAvatar: urlMap.get(staticImages.defaultAvatar) || '',
            editIcon: urlMap.get(staticImages.editIcon) || ''
          }
        })
      }
    })
  },

  onShow() {
    // 更新自定义 TabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
    // 页面显示时刷新数据
    this.loadUserInfo()
    if (this.data.hasUserInfo) {
      this.loadStudyStats()
    } else {
      // 未登录时重置数据
      this.setData({
        totalQuestions: 0,
        correctQuestions: 0,
        accuracy: 0,
        studyDays: 0
      })
    }
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
            showLoginModal: false
          })
          
          wx.setStorageSync('userInfo', userInfo)
          
          // 登录成功后加载统计数据
          this.loadStudyStats()
          
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
  // 加载学习统计数据
  loadStudyStats() {
    // console.log('Starting loadStudyStats...');
    wx.cloud.callFunction({
      name: 'study',
      data: {
        action: 'getUserStats'
      },
      success: res => {
        // console.log('loadStudyStats success:', res);
        if (res.result && res.result.code === 0) {
          const { totalQuestions, correctQuestions, accuracy, studyDays } = res.result.data
          this.setData({
            totalQuestions,
            correctQuestions,
            accuracy,
            studyDays
          })
        } else {
          console.warn('loadStudyStats returned non-zero code:', res.result);
        }
      },
      fail: err => {
        console.error('获取学习统计失败', err)
      }
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          this.setData({
            userInfo: {},
            hasUserInfo: false,
            totalQuestions: 0,
            correctQuestions: 0,
            accuracy: 0,
            studyDays: 0
          })
        }
      }
    })
  },

  // 导航到我的收藏
  navigateToCollection() {
    wx.navigateTo({
      url: '/pages/record-list/record-list?type=favorite'
    })
  },

  // 导航到我的错题
  navigateToWrong() {
    wx.navigateTo({
      url: '/pages/record-list/record-list?type=mistake'
    })
  },

  // 导航到学习计划
  navigateToStudyPlan() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 导航到设置
  navigateToSettings() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 导航到关于我们
  navigateToAbout() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})
