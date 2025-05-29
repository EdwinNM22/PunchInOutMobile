export async function sendPush(expoToken, title, body, data = {}) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        to      : expoToken,
        title,
        body,
        data,
        sound   : 'default'
      })
    });
  } catch(e){ console.error('Expo push error',e); }
}