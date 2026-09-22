import path from 'node:path';
import { spawnSync } from 'node:child_process';
export function compile(args){
  const binary=process.platform==='win32'?path.resolve(`node_modules/@esbuild/win32-${process.arch}/esbuild.exe`):path.resolve(`node_modules/@esbuild/${process.platform}-${process.arch}/bin/esbuild`);
  // Inherit output: avoid the IPC pipe used by esbuild's JavaScript service API.
  const result=spawnSync(binary,args,{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('Compilation failed.');
}
