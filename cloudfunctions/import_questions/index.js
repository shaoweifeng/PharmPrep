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

  // [优化] 清除涉及教材的章节缓存，以便下次读取时重新计算
  const affected = new Set()
  questions.forEach(q => {
    if (q.subject && q.textbook) {
      affected.add(`${q.subject}::${q.textbook}`)
    }
  })

  if (affected.size > 0) {
    try {
      for (const key of affected) {
        const [subject, textbook] = key.split('::')
        // 删除该教材对应的缓存记录
        await db.collection('catalogs').where({ subject, textbook }).remove()
      }
      console.log('Cache cleared for:', Array.from(affected))
    } catch (err) {
      console.warn('Cache clear failed (catalogs collection might not exist):', err)
    }
  }

  return {
    code: 0,
    results
  }
}
