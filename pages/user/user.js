// pages/user/user.js
const newQuestionsData = require('../../data/questions/prompt1_result_20260131_084502.js')

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
  },

  // 导入题目数据
  importQuestions() {
    const that = this
    wx.showModal({
      title: '确认导入',
      content: '确定要将 prompt1_result_20260131_084502.json 中的数据导入云数据库吗？',
      success(res) {
        if (res.confirm) {
          that.doImport()
        }
      }
    })
  },

  doImport() {
    wx.showLoading({ title: '准备数据...' })
    
    // 资源映射
    const resourceMap = {
      'ylx_xxzd_1': { subject: '药理学', textbook: '药理学习题指导' }
    }

    // 中文数字转阿拉伯数字辅助函数
    const chnToNum = (chnStr) => {
      const chnNumChar = { '零':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 }
      const chnNameValue = {
        '十': { value: 10, secUnit: false },
        '百': { value: 100, secUnit: false },
        '千': { value: 1000, secUnit: false },
        '万': { value: 10000, secUnit: true },
        '亿': { value: 100000000, secUnit: true }
      }
      
      let rtn = 0
      let section = 0
      let number = 0
      let secUnit = false
      let str = chnStr.split('')

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

    const processedQuestions = newQuestionsData.map(item => {
      const resourceInfo = resourceMap[item.resource] || { subject: '未知科目', textbook: '未知教材' }
      
      // 提取章节号： "第四十七章" -> "四十七" -> 47
      let chapterNum = 0
      const match = item.chapter.match(/第(.+)章/)
      if (match) {
        chapterNum = chnToNum(match[1])
      }
      
      // 生成逻辑ID: resource_chapterNum_No
      // 为了保证排序正确，对章节号和题号进行补零
      // 例如: ylx_xxzd_1_00047_00001 (假设章节号最多5位，题号最多5位，根据实际情况调整)
      // 这里章节号补2位，题号补5位，例如 ylx_xxzd_1_47_00001
      const chapterStr = String(chapterNum).padStart(2, '0') // 47
      const noStr = String(item.No).padStart(5, '0') // 00001
      
      const _id = `${item.resource}_${chapterStr}_${noStr}`
      
      return {
        _id,
        resource: item.resource,
        chapter: item.chapter,
        No: item.No,
        type: item.type,
        question: item.question,
        options: item.choose, // 统一字段名
        answer: item.answer,
        explanation: item.explanation,
        subject: resourceInfo.subject,
        textbook: resourceInfo.textbook
      }
    })

    console.log('Processed Data Sample:', processedQuestions[0])
    
    wx.showLoading({ title: `上传 ${processedQuestions.length} 条...` })
    
    wx.cloud.callFunction({
      name: 'import_questions',
      data: {
        questions: processedQuestions
      },
      success: res => {
        wx.hideLoading()
        console.log('导入完成', res)
        const result = res.result.data || {}
        wx.showModal({
          title: '导入完成',
          content: `总数: ${result.total}\n成功: ${result.success}\n失败: ${result.failed}`,
          showCancel: false
        })
      },
      fail: err => {
        wx.hideLoading()
        console.error('调用失败', err)
        wx.showModal({ title: '调用失败', content: err.errMsg, showCancel: false })
      }
    })
  }
})
