import { afterEach, beforeEach, expect } from '@rstest/core'
import { cleanup } from '@testing-library/react'
import * as jestDomMatchers from '@testing-library/jest-dom/matchers'
import { resetStudioUi } from '../src/presentation/state/studioUi'
import { startPlatform } from './fixtures/platform'

expect.extend(jestDomMatchers)

beforeEach(async () => {
  // Export downloads assign a blob URL, which the SDK cannot use as a collector base.
  window.location.href = 'http://localhost:5005/'
  startPlatform()
  await new Promise((resolve) => setTimeout(resolve, 0))
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  resetStudioUi()
})
