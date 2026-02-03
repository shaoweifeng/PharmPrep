// cloudfunctions/import_questions/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { questions } = event
  
  if (!questions || !Array.isArray(questions)) {
    return { code: -1, msg: 'No questions provided' }
  }

  const results = []
  
  for (const question of questions) {
    try {
      // 检查是否存在
      const exist = await db.collection('questions').where({
        _id: question._id
      }).get()

      if (exist.data.length > 0) {
        // 更新
        await db.collection('questions').doc(question._id).set({
          data: question
        })
        results.push({ id: question._id, status: 'updated' })
      } else {
        // 新增
        await db.collection('questions').add({
          data: question
        })
        results.push({ id: question._id, status: 'added' })
      }
    } catch (err) {
      console.error(err)
      results.push({ id: question._id, status: 'failed', error: err.message })
    }
  }

  return {
    code: 0,
    results
  }
}
