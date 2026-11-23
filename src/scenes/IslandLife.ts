import Phaser from 'phaser';

export class IslandLife {
  danger=false;
  private elapsed=0;
  private ink: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene){this.ink=scene.add.graphics().setDepth(.5);}
  draw(delta:number,reduced:boolean){
    this.elapsed+=delta;
    const t=reduced?0:this.elapsed/1000, g=this.ink;
    g.clear();
    // Map-space coordinates keep reflections, lava and embers attached to their scenery.
    g.fillStyle(0xff891b,.09+.045*Math.sin(t*2)).fillEllipse(401,170,264,79);
    for(let i=0;i<22;i++){
      const f=(t*(this.danger?.55:.23)+i*.618)%1;
      g.fillStyle(i%2?0xff9b34:0xffdd86,(1-f)*.86)
        .fillCircle(300+(i*41)%209+Math.sin(t+i)*6,164-f*(this.danger?117:66),1.2+(i%3)*.65);
    }
    for(let i=0;i<44;i++){
      const x=754+(i*53)%400, y=348+(i*47)%245, k=(t*.36+i*.62)%1;
      g.lineStyle(1.4,0xbeefed,Math.sin(k*Math.PI)*.35)
        .lineBetween(x+k*11,y,x+9+(i%5)*3+k*11,y-1);
    }
  }
}
