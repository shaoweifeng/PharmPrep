// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { questions } = event
  
  if (!questions || !Array.isArray(questions)) {
    return { code: -1, msg: 'invalid data' }
  }

  const results = {
    total: questions.length,
    success: 0,
    failed: 0,
    errors: []
  }

  // 批量写入，云函数限制每次最多 1000 条，但建议分批次，比如 50 条一组
  const BATCH_SIZE = 50
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE)
    const tasks = batch.map(q => {
      // 使用 _id 确保幂等性，如果已存在则覆盖(set)
      // 注意：set 操作 data 中不能包含 _id，否则会报 invalid parameters
      const { _id, ...questionData } = q
      return db.collection('questions').doc(_id).set({
        data: questionData
      }).then(() => {
        results.success++
      }).catch(err => {
        results.failed++
        results.errors.push({ id: q._id, errMsg: err.errMsg })
      })
    })

    await Promise.all(tasks)
  }

  return {
    code: 0,
    data: results
  }
}