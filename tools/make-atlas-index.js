// Builds assets/atlas-hd.json and assets/atlas-uhd.json: every sheet's frame table, so the page does not have to download and parse the large plist files.
const fs=require('fs');
const stems=['PixelSheet_01','GJ_GameSheet','GJ_GameSheet02','GJ_GameSheet03','GJ_ParticleSheet','FireSheet_01','GJ_GameSheet04','GJ_GameSheetEditor'];
const num=s=>(String(s).match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);
for(const q of ['hd','uhd']){
  const out={}; let total=0;
  for(const stem of stems){
    const f='assets/'+stem+'-'+q+'.plist'; if(!fs.existsSync(f)) continue;
    const xml=fs.readFileSync(f,'utf8'); const start=xml.indexOf('<key>frames</key>'); const end=xml.indexOf('<key>metadata</key>');
    const first=xml.indexOf('<dict>',start)+6; const body=xml.slice(first, end>start?end:xml.length); const frames={};
    const re=/<key>([^<]+)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g; let m;
    while((m=re.exec(body))){ const d=m[2];
      const rect=/<key>(?:textureRect|frame)<\/key>\s*<string>([^<]*)<\/string>/.exec(d); if(!rect) continue;
      const rot=/<key>(?:textureRotated|rotated)<\/key>\s*<(true|false)\s*\/>/.exec(d);
      const off=/<key>(?:spriteOffset|offset)<\/key>\s*<string>([^<]*)<\/string>/.exec(d);
      const r=num(rect[1]), o=off?num(off[1]):[0,0];
      frames[m[1]]=[r[0],r[1],r[2],r[3],rot&&rot[1]==='true'?1:0,o[0]||0,o[1]||0]; total++; }
    out[stem]=frames;
  }
  fs.writeFileSync('assets/atlas-'+q+'.json',JSON.stringify(out)); console.log(q,total,'frames',(fs.statSync('assets/atlas-'+q+'.json').size/1024|0)+'KB');
}
