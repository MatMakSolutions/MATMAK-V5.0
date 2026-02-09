/**
 * Wait for an element to appear in the DOM and resolve the promise with the element.
 * @param querySelector The query selector for the element to wait for.
 * @returns A promise that resolves with the element when it appears in the DOM.
 */
export async function waitForElt<T extends Element>(querySelector: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
      const element = document.querySelector<T>(querySelector);
      if (element) {
          resolve(element);
      } else {
          const observer = new MutationObserver(() => {
              const element = document.querySelector<T>(querySelector);
              if (element) {
                  observer.disconnect();
                  resolve(element);
                  clearTimeout(tmIdx);
              }
          });

          observer.observe(document.body, {
              childList: true,
              subtree: true,
          });

          // Optionally, add a timeout to reject the promise if element does not appear
          const tmIdx = setTimeout(() => {
              observer.disconnect();
              reject(new Error(`Element with selector "${querySelector}" not found within the timeout.`));
          }, 10000); // Timeout duration in milliseconds (e.g., 10 seconds)
      }
  });
}


export async function waitForMs(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
      setTimeout(() => {
          resolve();
      }, ms);
  });
}