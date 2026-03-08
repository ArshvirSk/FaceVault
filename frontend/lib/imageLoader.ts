// Image loading queue with concurrency control
class ImageLoadQueue {
  private queue: Array<() => Promise<void>> = []
  private activeCount = 0
  private readonly maxConcurrent: number

  constructor(maxConcurrent: number = 6) {
    this.maxConcurrent = maxConcurrent
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.activeCount--
          this.processNext()
        }
      }

      this.queue.push(task)
      this.processNext()
    })
  }

  private processNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return
    }

    const task = this.queue.shift()
    if (task) {
      this.activeCount++
      task()
    }
  }
}

export const imageLoadQueue = new ImageLoadQueue(6) // Max 6 concurrent image loads
