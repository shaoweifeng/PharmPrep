Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#3498db",
    list: [{
      pagePath: "/pages/index/index",
      text: "首页",
      iconPath: "", 
      selectedIconPath: "",
      cloudIcon: "tabbar/home.png", // 默认假设
      cloudSelectedIcon: "tabbar/home-active.png"
    }, {
      pagePath: "/pages/user/user",
      text: "个人中心",
      iconPath: "",
      selectedIconPath: "",
      cloudIcon: "tabbar/user.png", 
      cloudSelectedIcon: "tabbar/user-active.png"
    }]
  },
  attached() {
    this.initCloudImages()
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({url})
    },
    initCloudImages() {
       const app = getApp()
       const cloudBase = app.globalData.cloudImageBase
       
       const fileList = []
       this.data.list.forEach(item => {
         fileList.push(cloudBase + '/' + item.cloudIcon)
         fileList.push(cloudBase + '/' + item.cloudSelectedIcon)
       })
       
       wx.cloud.getTempFileURL({
         fileList,
         success: res => {
           const urlMap = new Map()
           res.fileList.forEach(item => {
             if(item.status === 0) {
               urlMap.set(item.fileID, item.tempFileURL)
             }
           })
           
           const newList = this.data.list.map(item => ({
             ...item,
             iconPath: urlMap.get(cloudBase + '/' + item.cloudIcon) || item.iconPath,
             selectedIconPath: urlMap.get(cloudBase + '/' + item.cloudSelectedIcon) || item.selectedIconPath
           }))
           
           this.setData({ list: newList })
         },
         fail: err => {
           console.error("Tabbar icons load failed", err)
         }
       })
    }
  }
})