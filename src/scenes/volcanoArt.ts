import Phaser from 'phaser';
import { BOARD_TOP, BOARD_H, VIEW, iy } from './layout';

type Point = [number, number];

const COAST: Point[] = [
  [14,331],[32,301],[71,275],[97,250],[184,241],[265,255],[315,281],[354,299],
  [379,329],[376,364],[361,391],[369,415],[339,453],[302,474],[261,471],
  [220,490],[154,483],[108,466],[73,443],[42,412],[20,374],
];

function polygon(g: Phaser.GameObjects.Graphics, color: number, points: Point[], dy = 0, alpha = 1): void {
  g.fillStyle(color, alpha).fillPoints(points.map(([x, y]) => new Phaser.Math.Vector2(x, iy(y + dy))), true);
}

function ridge(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  polygon(g, 0x20252d, [[x-s,y],[x-s*.56,y-s*.74],[x+s*.25,y-s],[x+s,y-s*.35],[x+s*.73,y+s*.19]]);
  polygon(g, 0x57616a, [[x-s,y],[x-s*.56,y-s*.74],[x+s*.25,y-s],[x+s*.12,y-s*.18]]);
  polygon(g, 0x38434a, [[x+s*.25,y-s],[x+s,y-s*.35],[x+s*.73,y+s*.19],[x+s*.12,y-s*.18]]);
}

function pine(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(0x0d2025, .45).fillEllipse(x + s*.3, iy(y), s*1.7,s*.39);
  g.fillStyle(0x524038).fillRect(x-1,iy(y-s*.7),2.5,s*.73);
  for(const tier of [0,.27,.53]){
    const cy=y-s*(.35+tier), spread=s*(.56-tier*.48);
    polygon(g, 0x123b38, [[x-spread,cy],[x+s*.12,cy-s*.69],[x+spread,cy+s*.06],[x,cy+s*.22]]);
    polygon(g, 0x2d6550, [[x-spread,cy],[x+s*.12,cy-s*.69],[x,cy+s*.22]]);
  }
}

export function drawVolcanoArt(scene: Phaser.Scene, route: { x: number; y: number }[]): void {
  const back=scene.add.graphics().setDepth(0);
  back.fillStyle(0x111720).fillRect(0, 0, VIEW.w, VIEW.h);
  // Hand-built colour bands keep the sea legible behind the route and HUD.
  const upper=new Phaser.Display.Color(24,33,45), lower=new Phaser.Display.Color(11,61,78);
  for(let row=0;row<BOARD_H;row+=3){
    const c=Phaser.Display.Color.Interpolate.ColorWithColor(upper,lower,BOARD_H,row);
    back.fillStyle(Phaser.Display.Color.GetColor(c.r,c.g,c.b)).fillRect(0,BOARD_TOP+row,VIEW.w,3);
  }
  back.fillStyle(0xff7047,.06).fillCircle(192,iy(153),110);
  back.fillStyle(0xff7047,.08).fillCircle(192,iy(154),70);
  polygon(back,0x33414d,[[0,263],[25,238],[60,228],[89,244],[128,232],[185,257],[224,243],[276,251],[321,227],[359,242],[390,224],[390,288],[0,290]],0,.65);
  polygon(back,0x213845,[[0,274],[46,264],[92,267],[149,273],[203,257],[275,269],[337,253],[390,271],[390,302],[0,302]],0,.75);
  let seed=3057;
  const random=()=> (seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<155;i++){
    const x=random()*VIEW.w,y=268+random()*250,w=3+random()*23;
    back.lineStyle(.6+random(),i%7?0x65acb7:0xaee0d6,.12+random()*.23)
      .lineBetween(x,iy(y),x+w,iy(y)-.7);
  }
  polygon(back,0x28777c,COAST,13);
  polygon(back,0x64a79f,COAST,8);
  polygon(back,0x395254,COAST,5);
  polygon(back,0x212d34,COAST,-1);
  polygon(back,0x738079,COAST,-10);
  polygon(back,0x344b47,COAST,-15);
  polygon(back,0x466052,[[25,326],[65,297],[114,279],[145,312],[113,347],[151,396],[139,443],[104,442],[51,407]]);
  polygon(back,0x293f43,[[216,291],[275,269],[348,297],[372,324],[366,359],[355,382],[314,409],[258,387]]);
  polygon(back,0x536555,[[57,398],[117,415],[153,420],[194,397],[228,420],[264,440],[304,425],[340,444],[292,460],[257,458],[217,474],[153,469],[101,450]]);
  for(let i=0;i<125;i++){
    const x=25+random()*340,y=275+random()*168;
    if(x<45&&y<312||x>344&&y<306||route.some(p=>Math.hypot(p.x-x,p.y-iy(y))<15))continue;
    if(x>96&&x<293&&y<311)continue;
    if((x<114||x>284)&&i%3===0)pine(back,x,y,7+random()*12);
    else ridge(back,x,y,1.4+random()*4+i%3);
  }
  const v=scene.add.graphics().setDepth(.5);
  // The plume uses overlapping asymmetric ash layers, with lit edges nearer the crater.
  for(let i=0;i<7;i++){
    const x=191+i*i*.96,y=112-i*6.5;
    v.fillStyle(i<3?0x655363:0x435060,.19+i*.035).fillEllipse(x,iy(y),29+i*9,16+i*5);
  }
  polygon(v,0x242733,[[83,313],[110,280],[122,236],[148,211],[154,180],[175,156],[173,135],[189,125],[209,129],[225,149],[237,187],[265,209],[276,257],[310,300],[267,317],[190,320],[139,316]]);
  polygon(v,0x4c4b57,[[83,313],[110,280],[122,236],[148,211],[154,180],[175,156],[173,135],[192,141],[185,176],[180,211],[156,240],[145,282],[126,315]]);
  polygon(v,0x393543,[[126,315],[145,282],[156,240],[180,211],[185,176],[192,141],[206,143],[206,182],[222,221],[221,263],[207,286],[190,320]]);
  polygon(v,0x51505c,[[206,143],[215,141],[225,149],[237,187],[265,209],[276,257],[256,242],[240,219],[222,221],[206,182]]);
  polygon(v,0x31333e,[[222,221],[240,219],[256,242],[276,257],[310,300],[267,317],[190,320],[207,286],[221,263]]);
  v.fillStyle(0xff7348,.18).fillEllipse(194,iy(134),63,28);
  v.fillStyle(0x1d1d2b).fillEllipse(194,iy(134),49,15);
  v.fillStyle(0xff6338).fillEllipse(193,iy(135),39,9);
  v.fillStyle(0xffcc76).fillEllipse(194,iy(135),29,4);
  polygon(v,0x984642,[[188,139],[202,139],[196,167],[208,188],[202,216],[223,248],[216,264],[199,223],[196,204],[201,187],[190,171]]);
  polygon(v,0xff6637,[[191,140],[198,139],[194,171],[204,187],[198,215],[214,243],[207,234],[194,216],[200,189],[189,171]]);
  for(let i=0;i<52;i++){
    const x=126+random()*144,y=79+random()*206;
    if(y>157&&Math.abs(x-194)>22)continue;
    v.fillStyle(i%3===0?0xffd283:0xff7047,.28+random()*.62).fillCircle(x,iy(y),.45+random()*1.35);
  }

  const links=scene.add.graphics().setDepth(.85);
  const routeLine=route.map(p=>new Phaser.Math.Vector2(p.x, p.y + 9));
  links.lineStyle(6,0x15262c,.94).strokePoints(routeLine,false);
  links.lineStyle(2,0xaac8a4,.8).strokePoints(routeLine,false);

  const pier=scene.add.graphics().setDepth(iy(430));
  polygon(pier,0x17282e,[[330,425],[343,423],[353,461],[366,466],[365,475],[312,480],[308,469],[341,461]],7);
  polygon(pier,0x755d54,[[330,424],[343,422],[351,460],[366,463],[365,472],[312,478],[308,469],[339,460]]);
  for(let y=430;y<461;y+=4){
    const x=330+(y-424)*.25;
    pier.lineStyle(1.1,0xbda28b).lineBetween(x,iy(y),x+12,iy(y)-2);
  }
  for(const [x,y] of [[312,469],[328,466],[350,462],[365,463]]){
    pier.fillStyle(0x26303a).fillRect(x-1,iy(y)-6,2,12);
    pier.fillStyle(0xffbe68).fillCircle(x,iy(y)-6,2.2);
  }
}
