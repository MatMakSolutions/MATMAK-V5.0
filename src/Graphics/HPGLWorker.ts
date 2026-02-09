// HPGL Parser Web Worker
self.onmessage = function(e) {
  const { hpgl, ratio, surfaceHeight } = e.data;
  
  try {
    const paths = parseHPGLInWorker(hpgl, ratio, surfaceHeight);
    self.postMessage({ paths, error: null });
  } catch (error) {
    self.postMessage({ paths: null, error: error.message });
  }
};

function parseHPGLInWorker(hpgl: string, ratio: number, surfaceHeight: number): {x: number, y: number}[][] {
  const paths: {x: number, y: number}[][] = [];
  let currentPath: {x: number, y: number}[] | null = null;
  let penDown = false;

  const commands = hpgl.split(';').filter(cmd => cmd.trim() !== '');

  for (const command of commands) {
    const instruction = command.substring(0, 2);
    const argsStr = command.substring(2);
    
    if (!argsStr) {
      if (instruction === 'PD') penDown = true;
      if (instruction === 'PU') penDown = false;
      continue;
    }

    const coords = argsStr.split(',').map(Number);

    if (instruction === 'PU') {
      penDown = false;
      if (currentPath && currentPath.length > 1) {
        paths.push(currentPath);
      }
   
      if (coords.length >= 2) {
        const x = coords[0] / ratio;
        const y = (surfaceHeight - coords[1]) / ratio;
        currentPath = [{ x: x, y: y }];
      } else {
        currentPath = null;
      }
    } else if (instruction === 'PD') {
      penDown = true;
      if (!currentPath) {
        currentPath = [];
      }
      if (argsStr) {
        for (let i = 0; i < coords.length; i += 2) {
          const x = coords[i] / ratio;
          const y = (surfaceHeight - (coords[i+1] || 0)) / ratio;
          currentPath.push({ x: x, y: y });
        }
      }
    } else if (instruction === 'PA') {
      if (coords.length >= 2) {
        const x = coords[0] / ratio;
        const y = (surfaceHeight - coords[1]) / ratio;
        const point = { x: x, y: y };
        
        if (penDown) {
          if (!currentPath) currentPath = [];
          if(currentPath.length === 0) {
            const lastPath = paths[paths.length -1];
            if(lastPath) currentPath.push(lastPath[lastPath.length-1]);
          }
          currentPath.push(point);
        } else {
          if (currentPath && currentPath.length > 1) {
            paths.push(currentPath);
          }
          currentPath = [point];
        }
      }
    }
  }

  if (currentPath && currentPath.length > 1) {
    paths.push(currentPath);
  }

  const rotatedPaths = paths.map(path => 
    path.map(point => {
      return { x: point.y, y: -point.x };
    })
  );

  return rotatedPaths;
}


