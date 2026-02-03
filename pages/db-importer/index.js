// pages/db-importer/index.js
const allQuestions = require('../../data/questions/all_questions.js')

Page({
  data: {
    importing: false,
    logs: '',
    questionCount: 0
  },

  onLoad() {
    this.setData({
      questionCount: allQuestions.length
    })
  },

  addLog(msg) {
    this.setData({
      logs: this.data.logs + msg + '\n'
    })
  },

  async startImport() {
    this.setData({ importing: true, logs: '' })
    this.addLog('开始准备数据...')
    
    this.addLog(`共加载 ${allQuestions.length} 道题目`)
    
    // 分批上传，每次5条
    const BATCH_SIZE = 5
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
      const batch = allQuestions.slice(i, i + BATCH_SIZE)
      this.addLog(`正在上传第 ${i+1}-${Math.min(i+BATCH_SIZE, allQuestions.length)} 条...`)
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'import_questions',
          data: {
            questions: batch
          }
        })
        
        if (res.result.code === 0) {
          const added = res.result.results.filter(r => r.status === 'added').length
          const updated = res.result.results.filter(r => r.status === 'updated').length
          const failed = res.result.results.filter(r => r.status === 'failed').length
          
          successCount += (added + updated)
          failCount += failed
          
          this.addLog(`批次结果: 新增 ${added}, 更新 ${updated}, 失败 ${failed}`)
        } else {
          this.addLog(`批次失败: ${res.result.msg}`)
          failCount += batch.length
        }
      } catch (err) {
        console.error(err)
        this.addLog(`调用云函数失败: ${err.message}`)
        failCount += batch.length
      }
    }
    
    this.addLog('----------------')
    this.addLog(`导入完成！成功: ${successCount}, 失败: ${failCount}`)
    this.setData({ importing: false })
    
    if (failCount === 0) {
      wx.showToast({ title: '全部导入成功', icon: 'success' })
    } else {
      wx.showModal({ title: '导入完成', content: `成功 ${successCount}，失败 ${failCount}，请查看日志` })
    }
  }
})
