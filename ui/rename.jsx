import React from 'react';
import {useSelector} from 'react-redux';

export function RenamePanel({actions}){
  const view=useSelector(state=>state.studioUi.renameView);
  return <article className="panel"><h2>RENOMBRAR ASSETS</h2><p className="studio-help">Convierte <code>[num]_[id]-[prompt].ext</code> en <code>[id].ext</code> dentro de una carpeta seleccionada. Muestra cuántos archivos válidos se encontraron antes de aplicar.</p>
    <div className="studio-actions"><button className="secondary" onClick={actions.selectFolder}>Seleccionar carpeta</button><button className="primary" onClick={actions.run} disabled={!view.count||view.duplicates>0}>Renombrar archivos válidos</button></div>
    <div className="studio-list" role="status">{view.message}</div>
  </article>;
}
