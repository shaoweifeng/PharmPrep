// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  const { avatarUrl, nickName } = event
  
  // 1. 尝试查询用户是否已存在
  const userRes = await db.collection('users').where({
    _openid: openid
  }).get()
  
  const now = new Date()
  
  let userData = {}
  
  if (userRes.data.length > 0) {
    // 2. 用户存在，更新信息
    const docId = userRes.data[0]._id
    await db.collection('users').doc(docId).update({
      data: {
        avatarUrl,
        nickName,
        lastLoginTime: now
      }
    })
    userData = { ...userRes.data[0], avatarUrl, nickName, lastLoginTime: now }
  } else {
    // 3. 用户不存在，创建新用户
    const addRes = await db.collection('users').add({
      data: {
        _openid: openid,
        avatarUrl,
        nickName,
        createTime: now,
        lastLoginTime: now,
        totalQuestions: 0,
        correctQuestions: 0,
        studyDays: 1 // 初始第一天
      }
    })
    userData = {
      _id: addRes._id,
      _openid: openid,
      avatarUrl,
      nickName,
      createTime: now,
      lastLoginTime: now,
      totalQuestions: 0,
      correctQuestions: 0,
      studyDays: 1
    }
  }
  
  return {
    code: 0,
    msg: 'success',
    data: userData
  }
}