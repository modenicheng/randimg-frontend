/// <reference types="vite/client" />
declare module '*.vue' {
    import { ComponentOptions } from 'vue'
    const componentOptions: ComponentOptions
    export default componentOptions
  }
declare module 'si-log' {
    const siLog: {
      create(name: string): {
        debug(...args: any[]): void
        info(...args: any[]): void
        warn(...args: any[]): void
        error(...args: any[]): void
      }
    }
    export default siLog
}