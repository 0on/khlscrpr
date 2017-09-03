const TelegramBot = require('node-telegram-bot-api')
const Xray = require('x-ray')

const x = Xray()
const cache = {}
const token = process.env.KEY

const bot = new TelegramBot(token, { polling: true })


const scrap = matchId => x(`http://text.khl.ru/text/${matchId}.html`, {
  items: x('.b-text_translation_item', [{
    time: '.e-event_time',
    action: '.e-action_txt',
    many: '.e-abbr',
    newScore: '.m-goal h3',
  }]),
})

const prepareItems = items => items
  .filter(item => item.time !== 'Реклама')
  .reverse()

const createMessage = item => {
  const time = item.time
    ? `${item.time} - `
    : ''
  return item.action
    ? `${time}${item.action}`
    : `${time}${item.newScore} (${item.many})`
}


const sender = (chatId, items) => {
  if (items.length === 0) return Promise.resolve()
  const item = items.shift()


  const p = new Promise(resolve => {
    setTimeout(() => {
      bot.sendMessage(
        chatId,
        createMessage(item)
      )
        .then(resolve)
    }, 1000)
  })
  p.then(() => sender(chatId, items))
  return p
}

const run = () => {
  setInterval(() => {
    console.log(cache)
    Object.keys(cache).forEach(chatId => {
      const games = cache[chatId]
      Object.keys(games).forEach(game => {
        const oldResults = games[game]
        scrap(game)(
          (err, { items }) => {
            if (err) return
            const newResults = prepareItems(items)
            const delta = newResults.slice(oldResults.length)
            if (delta.length === 0) return
            sender(chatId, delta)
              .then(() => {
                console.log(newResults[newResults.length - 1].action)
                if (newResults[newResults.length - 1].action === 'Окончание игры') {
                  console.log(`remove chat ${chatId} game ${game}`)
                  delete cache[chatId][game]
                  return
                }
                cache[chatId][game] = newResults
              })
          }
        )
      })
    })
  }, 60000)
}

bot.on('message', message => {
  const gameId = /start-(\d.*)/.exec(message.text)[1]
  const chatId = message.from.id
  console.log(`add chat ${chatId} game ${gameId}`)
  cache[chatId] = {}
  cache[chatId][gameId] = []
})

run()
