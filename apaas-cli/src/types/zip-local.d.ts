declare module 'zip-local' {
  interface Zipped {
    compress(): void;
    memory(): Buffer;
    save(path: string, callback: (error?: unknown) => void): void;
  }

  interface ZipLocalStatic {
    zip(path: string, callback: (error: unknown, zipped: Zipped) => void): void;
  }

  const zipper: ZipLocalStatic;
  export = zipper;
}

