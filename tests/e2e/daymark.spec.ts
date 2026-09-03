import { expect, test, type Page } from '@playwright/test'

const jiraIssue = {
  jiraKey: 'OPS-421',
  jiraUrl: 'https://acme.atlassian.net/browse/OPS-421',
  summary: 'Order status API',
  project: { name: 'Commerce', jiraProjectKey: 'OPS' },
}

async function mockJiraSuccess(page: Page, issue = jiraIssue) {
  await page.route('**/api/jira/lookup', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(issue),
  }))
}

async function openAddTask(page: Page, keyboard = false) {
  await page.waitForLoadState('networkidle')
  const button = page.getByRole('button', { name: 'เพิ่มงาน', exact: true })
  await expect(button).toBeEnabled()
  if (keyboard) {
    await button.focus()
    await page.keyboard.press('Enter')
  }
  else {
    await button.click()
  }
  await expect(page.getByRole('heading', { name: 'เพิ่มงานใหม่' })).toBeVisible()
}

async function importJiraTask(page: Page, issue = jiraIssue) {
  await mockJiraSuccess(page, issue)
  await openAddTask(page)
  await page.getByLabel('ลิงก์ Jira').fill(issue.jiraUrl)
  await page.getByRole('button', { name: 'ค้นหางาน' }).click()
  await expect(page.getByLabel('ชื่องาน')).toHaveValue(issue.summary)
  await page.getByRole('button', { name: 'เพิ่มเข้า Daily Focus' }).click()
  await expect(page.getByRole('heading', { name: 'เพิ่มงานใหม่' })).toBeHidden()
}

test.beforeEach(async ({ request }) => {
  const response = await request.post('/api/test/reset')
  expect(response.ok()).toBeTruthy()
})

test('imports Jira work, records progress, and completes it', async ({ page }) => {
  await page.goto('/')
  await importJiraTask(page)

  await page.getByRole('link', { name: /Order status API/ }).click()
  await page.getByLabel('สถานะ', { exact: true }).selectOption('in_progress')
  await expect(page.getByLabel('สถานะ', { exact: true })).toHaveValue('in_progress')

  await page.getByLabel('บันทึก', { exact: true }).fill('เพิ่ม validation และส่ง PR แล้ว')
  await page.getByLabel('นาที (ไม่บังคับ)', { exact: true }).fill('45')
  await page.getByRole('button', { name: 'เพิ่มบันทึก' }).click()
  await expect(page.getByText('เพิ่ม validation และส่ง PR แล้ว')).toBeVisible()

  await page.getByLabel('สถานะ', { exact: true }).selectOption('done')
  await expect(page.getByTestId('completed-at')).toBeVisible()
})

test('manual fallback creates a Todo task', async ({ page }) => {
  await page.route('**/api/jira/lookup', route => route.fulfill({
    status: 422,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'JIRA_INVALID_URL', message: 'Enter a valid Jira issue URL.' }),
  }))

  await page.goto('/')
  await openAddTask(page)
  await page.getByLabel('ลิงก์ Jira').fill('https://acme.atlassian.net/browse/MAN-101')
  await page.getByRole('button', { name: 'ค้นหางาน' }).click()
  await expect(page.getByText('ใช้การกรอกข้อมูลเอง')).toBeVisible()

  await page.getByLabel('รหัส Jira').fill('MAN-101')
  await page.getByLabel('ชื่อโปรเจกต์').fill('Manual project')
  await page.getByLabel('ชื่องาน').fill('Manual fallback task')
  await page.getByRole('button', { name: 'เพิ่มเข้า Daily Focus' }).click()

  await expect(page.getByRole('link', { name: /Manual fallback task/ })).toBeVisible()
  await expect(page.getByText('Todo', { exact: true }).first()).toBeVisible()
})

test('a duplicate Jira key links to the existing task', async ({ page }) => {
  await page.goto('/')
  await importJiraTask(page)

  await openAddTask(page)
  await page.getByLabel('ลิงก์ Jira').fill(jiraIssue.jiraUrl)
  await page.getByRole('button', { name: 'ค้นหางาน' }).click()
  await page.getByRole('button', { name: 'เพิ่มเข้า Daily Focus' }).click()

  const duplicate = page.getByTestId('duplicate-task')
  await expect(duplicate).toContainText('งานนี้มีอยู่แล้ว')
  await duplicate.getByRole('link', { name: 'เปิดงานที่มีอยู่' }).click()
  await expect(page.getByRole('heading', { name: jiraIssue.summary })).toBeVisible()
})

test('filters tasks by project and status', async ({ page, request }) => {
  const first = await request.post('/api/tasks', {
    data: {
      jiraUrl: 'https://acme.atlassian.net/browse/OPS-500',
      jiraKey: 'OPS-500',
      summary: 'Commerce Todo',
      project: { name: 'Commerce', jiraProjectKey: 'OPS' },
    },
  })
  expect(first.ok()).toBeTruthy()

  const second = await request.post('/api/tasks', {
    data: {
      jiraUrl: 'https://acme.atlassian.net/browse/WEB-700',
      jiraKey: 'WEB-700',
      summary: 'Website Done',
      project: { name: 'Website', jiraProjectKey: 'WEB' },
    },
  })
  const secondTask = await second.json()
  await request.patch(`/api/tasks/${secondTask.id}`, { data: { status: 'done' } })

  await page.goto('/tasks')
  await page.waitForLoadState('networkidle')
  const filters = page.getByRole('form', { name: 'ตัวกรองงาน' })
  await filters.locator('select[name="status"]').selectOption('done')
  await expect(page).toHaveURL(/status=done/)
  await expect(page.getByText('Website Done')).toBeVisible()
  await expect(page.getByText('Commerce Todo')).toBeHidden()

  await filters.locator('select[name="projectId"]').selectOption(secondTask.project.id)
  await expect(page).toHaveURL(new RegExp(`projectId=${secondTask.project.id}`))
  await expect(page.getByText('Website Done')).toBeVisible()
})

test('the add-task journey can be completed with the keyboard', async ({ page }) => {
  await page.goto('/')
  await mockJiraSuccess(page, {
    ...jiraIssue,
    jiraKey: 'OPS-901',
    jiraUrl: 'https://acme.atlassian.net/browse/OPS-901',
    summary: 'Keyboard workflow',
  })

  await openAddTask(page, true)
  await page.getByLabel('ลิงก์ Jira').focus()
  await page.keyboard.type('https://acme.atlassian.net/browse/OPS-901')
  await page.getByRole('button', { name: 'ค้นหางาน' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('ชื่องาน')).toHaveValue('Keyboard workflow')
  await page.getByRole('button', { name: 'เพิ่มเข้า Daily Focus' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: /Keyboard workflow/ })).toBeVisible()
})
