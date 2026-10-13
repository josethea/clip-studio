export function browserLaunchError(error,platform=process.platform){
  const detail=String(error?.message||error);
  if(!/Failed to launch the browser process|mach_port_rendezvous|BootstrapLookupMessage|Permission denied \(1100\)/i.test(detail))return null;
  if(platform==='darwin'&&/mach_port_rendezvous|BootstrapLookupMessage|Permission denied \(1100\)/i.test(detail)){
    return 'Remotion no pudo iniciar Chrome desde esta sesión restringida de macOS. Abre «Iniciar Clip Studio.command» desde Finder y vuelve a exportar. El proyecto y sus medios siguen guardados.';
  }
  const lines=detail.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const diagnostic=lines.find(line=>/error while loading shared libraries|cannot open shared object file|No usable sandbox|Running as root without --no-sandbox|Exec format error|Permission denied/i.test(line)&&!/Troubleshooting:|https?:\/\//i.test(line));
  const cause=diagnostic&&diagnostic!=='Failed to launch the browser process!'?` Causa: ${diagnostic.slice(0,450)}`:'';
  return `Remotion no pudo iniciar Chrome en este servidor.${cause} Ejecuta «npm run check:browser» en el VPS para ver el diagnóstico completo. El proyecto y sus medios siguen guardados.`;
}
