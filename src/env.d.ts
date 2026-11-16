interface ImportMetaEnv {
  readonly DEV: boolean
  readonly MODE: string
  readonly PROD: boolean
  readonly BUILD_VERSION?: string
  readonly RSTEST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css'
declare module '*.png' {
  const url: string
  export default url
}

declare module 'daisyui/theme/object.js' {
  const themes: Record<string, Record<string, string>>
  export default themes
}

declare module 'bpmn-js/lib/Modeler' {
  export default class BpmnModeler {
    constructor(options: { container: HTMLElement; additionalModules?: unknown[] })
    importXML(xml: string): Promise<{ warnings: unknown[] }>
    saveXML(options?: { format?: boolean }): Promise<{ xml?: string }>
    get(name: string): unknown
    on(event: string, callback: (event: unknown) => void): void
    destroy(): void
  }
}
