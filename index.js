const log = require('consola')
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const { writeFileSync } = require('fs')

const isCI = process.env.CI !== undefined;

if (isCI) {
  log.level = 3 // INFO
} else {
  log.level = 4 // DEBUG
}

(async () => {
  log.clear()

  const launchEnv = {}
  if (!isCI) {
    log.debug('로컬환경에서는 크로미움을 다운로드하지 않습니다.')
    launchEnv.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = true
  }

  const browser = await puppeteer.launch({
    headless: isCI,
    env: launchEnv
  })
  log.ready('헤드리스 브라우저 생성')

  const page = await browser.newPage()

  // alert 창 뜨면 닫기
  await page.on('dialog', async dialog => {
    await dialog.accept()
  })

  // 검색 페이지로 이동
  await page.goto('https://www.rra.go.kr/ko/license/A_c_search.do', { waitUntil : "networkidle2" } )

  // 데이터 입력
  await insertInput('#surch_for2', getToday()) // 시작
  await insertInput('#surch_for2_1', getToday()) // 종료
  await insertInput('#surch_for7', 'Apple Inc.') // 제조사

  // 검색 이벤트 발생
  // noinspection JSUnresolvedFunction
  await page.evaluate(() => list2())

  // 검색 결과 기다리기
  await page.waitForNavigation()
  await page.screenshot({ path: 'screenshot.png' })

  // 데이터 파싱

  // 검색결과 테이블을 추출하여 cheerio로 래핑
  const $ = cheerio.load(await page.evaluate(() => {
    const $table = document.getElementsByClassName('table_organ0')

    return $table ? $table[0].outerHTML : ''
  }))

  // 데이터 추가
  const data = []
  $('tbody tr').each(function (i, tr) {
    let $tr = $(tr)
    let $td = $tr.children('td')

    let $name = $($td[1])

    // 데이터 없으면 종료
    if ($name.length <= 0) {
      closeBrowser()
      return process.exit(0)
    }

    data.push({
      link: $name.children('a').attr('href'),
      name: $name.text().trim()
    })
  })

  // 데이터파일 작성
  writeFileSync('data.json', JSON.stringify(data))

  // 어플리케이션 종료
  await closeBrowser()

  async function insertInput(selector, value) {
    await page.waitForSelector(selector)
    await page.type(selector, value)
  }

  async function closeBrowser() {
    await page.close()
    await browser.close()
  }
})()

function getToday() {
  const today = new Date();
  const year = today.getFullYear()
  const month = `${today.getMonth() + 1}`.padStart(2, '0')
  const date = `${today.getDate()}`.padStart(2, '0')

  return year + month + date
}
