package com.ashmaz.shipahead.volcanicmath

import android.os.Bundle
import android.graphics.Paint
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.io.Serializable
import kotlin.math.*
import kotlin.random.Random

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { Voyage() } }
    }
}

private const val TITLE = "Emberwake Relay"
private val sea = Color(0xff124957)
private val ink = Color(0xff10383e)
private val gold = Color(0xffffcd62)
private val colors = listOf(Color(0xff077e83), Color(0xffbd4c23), Color(0xff7852a0), Color(0xff305bad))
private val names = listOf("You", "Tavi the Scout", "Brindle the Hound", "Pip the Mouser")
private enum class Gear(val title: String, val price: Int, val effect: String) {
    Stride("Twinstride Soles", 100, "Roll two dice"), Siphon("Spoolhook", 175, "Take one rival fuel"),
    Snare("Mire Stitch", 125, "Snag a rival for one turn"), Lift("Rotor Sling", 150, "Fly up to three stops toward fuel")
}
private enum class Phase { Panorama, Zoom, Ready, Walk, Quiz, Market, Wrap, End }
private data class Site(val x: Float, val y: Float, val links: List<Int>)
private fun site(x: Int, y: Int, vararg links: Int) = Site(x/100f,y/100f,links.toList())
// Outer beach circuit and inner caldera circuit, joined at six trailheads.
private val board = listOf(
    site(49,89,1,11,12), site(27,85,0,2), site(13,70,1,3,13),
    site(12,50,2,4), site(18,30,3,5,14), site(31,16,4,6),
    site(51,12,5,7,15), site(73,18,6,8), site(86,33,7,9,16),
    site(89,52,8,10), site(85,70,9,11,17), site(70,85,10,0),
    site(48,72,0,13,17), site(31,62,2,12,14), site(33,39,4,13,15),
    site(51,29,6,14,16), site(69,40,8,15,17), site(68,62,10,16,12)
)
private val shops = setOf(3,9,15)
private val maths = setOf(1,4,5,7,10,11,12,13,16,17)
private data class Runner(val pos:Int=0,val fuel:Int=0,val cash:Int=0,
    val bag:List<Gear> = emptyList(),val skip:Boolean=false):Serializable
private data class Puzzle(val text:String,val key:Int,val choices:List<Int>,val missed:Int?=null):Serializable
private fun puzzle():Puzzle {
    val a=Random.nextInt(3,14)
    val b=Random.nextInt(2,10)
    val (text,key)=when(Random.nextInt(4)){
        0 -> "$a + $b" to a+b
        1 -> "${a+b} − $b" to a
        2 -> "$a × $b" to a*b
        else -> "${a*b} ÷ $b" to a
    }
    return Puzzle(text,key,listOf(key,key+1,key+3).shuffled())
}
private data class Race(val crew:List<Runner>,val limit:Int,val cache:Int,
    val turn:Int=1,val who:Int=0,val phase:Phase=Phase.Panorama,val steps:Int=0,
    val prev:Int=-1,val used:Boolean=false,val doubled:Boolean=false,val dice:String="",
    val q:Puzzle?=null,val note:String=""):Serializable {
    val p get()=crew[who]
    fun edit(i:Int,r:Runner)=copy(crew=crew.mapIndexed { n,old -> if(n==i) r else old })
    fun routes()=board[p.pos].links.filter { it!=prev }
}
private fun distances(goal:Int):IntArray {
    val d=IntArray(board.size){99}
    val queue=ArrayDeque<Int>()
    queue.add(goal); d[goal]=0
    while(queue.isNotEmpty()){
        val i=queue.removeFirst()
        for(j in board[i].links) if(d[j]==99){ d[j]=d[i]+1; queue.add(j) }
    }
    return d
}
private fun Race.collect():Race {
    if(p.pos!=cache) return this
    val open=board.indices.filter { tile -> crew.none { it.pos==tile } }
    return edit(who,p.copy(fuel=p.fuel+1)).copy(cache=open.random(),note="${names[who]} collected a fuel canister.")
}
private fun Race.roll():Race {
    if(phase!=Phase.Ready || p.skip) return this
    val draws=List(if(doubled) 2 else 1){Random.nextInt(1,7)}
    return copy(phase=Phase.Walk,steps=draws.sum(),prev=-1,dice=draws.joinToString(" + "),note="")
}
private fun Race.step(tile:Int):Race {
    if(phase!=Phase.Walk || tile !in routes()) return this
    val moved=edit(who,p.copy(pos=tile)).copy(steps=steps-1,prev=p.pos).collect()
    if(moved.steps>0) return moved
    return when(tile){
        in maths -> moved.copy(phase=Phase.Quiz,q=puzzle())
        in shops -> moved.copy(phase=Phase.Market)
        else -> moved.copy(phase=Phase.Wrap)
    }
}
private fun Race.answer(value:Int):Race {
    val task=q ?: return this
    if(phase!=Phase.Quiz || value==task.missed) return this
    if(value!=task.key && task.missed==null)
        return copy(q=task.copy(missed=value),note="One more try.")
    val earned=when { value!=task.key -> 0; task.missed!=null -> 50; else -> 100 }
    return edit(who,p.copy(cash=p.cash+earned)).copy(phase=Phase.Wrap,q=null,
        note="${task.text} = ${task.key}. ${names[who]} earned $earned credits.")
}
private fun Race.buy(g:Gear):Race {
    if(phase!=Phase.Market || p.cash<g.price) return this
    return edit(who,p.copy(cash=p.cash-g.price,bag=p.bag+g)).copy(phase=Phase.Wrap,note="Packed ${g.title}.")
}
private fun Race.targets(g:Gear)=crew.indices.filter { i ->
    i!=who && when(g){Gear.Siphon -> crew[i].fuel>0; Gear.Snare -> !crew[i].skip; else -> false}
}
private fun Race.use(g:Gear,target:Int=-1):Race {
    if(phase!=Phase.Ready || used || p.skip || g !in p.bag) return this
    val bag=p.bag.toMutableList().apply { remove(g) }
    val base=edit(who,p.copy(bag=bag)).copy(used=true,note="${names[who]} used ${g.title}.")
    return when(g){
        Gear.Stride -> base.copy(doubled=true)
        Gear.Lift -> {
            val d=distances(cache)
            var pos=p.pos
            repeat(minOf(3,d[pos])) { pos=board[pos].links.minBy { d[it] } }
            base.edit(who,base.p.copy(pos=pos)).collect()
        }
        Gear.Snare,Gear.Siphon -> {
            if(target !in targets(g)) return this
            val rival=crew[target]
            if(g==Gear.Snare) base.edit(target,rival.copy(skip=true))
            else base.edit(target,rival.copy(fuel=rival.fuel-1)).edit(who,base.p.copy(fuel=p.fuel+1))
        }
    }
}
private fun Race.next():Race {
    if(phase!=Phase.Wrap) return this
    val i=(who+1)%crew.size
    if(i==0 && turn==limit) return copy(phase=Phase.End)
    return copy(who=i,turn=turn+if(i==0) 1 else 0,phase=Phase.Ready,used=false,doubled=false,
        dice="",steps=0,prev=-1,q=null,note="")
}
private fun Race.cpuGear():Race {
    for(g in listOf(Gear.Siphon,Gear.Lift,Gear.Stride,Gear.Snare)){
        val rival=targets(g).maxByOrNull { crew[it].fuel }
        val result=use(g,rival ?: -1)
        if(result!=this) return result
    }
    return roll()
}
private fun Race.cpuStep():Int {
    val fuelDistance=distances(cache)
    val options=routes()
    // Prefer the shortest fuel route, with a shop detour when able to buy.
    return options.shuffled().minBy { tile ->
        fuelDistance[tile]*3 - if(tile in shops && steps==1 && p.cash>=100 && p.bag.isEmpty()) 4 else 0
    }
}

@Composable private fun Voyage(){
    var page by rememberSaveable { mutableStateOf("home") }
    var cpus by rememberSaveable { mutableIntStateOf(2) }
    var length by rememberSaveable { mutableIntStateOf(15) }
    var race by rememberSaveable { mutableStateOf<Race?>(null) }
    var quit by rememberSaveable { mutableStateOf(false) }
    var gearMenu by rememberSaveable { mutableStateOf(false) }
    var targetGear by rememberSaveable { mutableStateOf<Gear?>(null) }
    fun start(){
        race=Race(List(cpus+1){ Runner() },length,(1 until board.size).random())
        gearMenu=false; targetGear=null; page="story"
    }
    BackHandler(page!="home"){
        if(page=="setup" || race?.phase==Phase.End){page="home"; race=null}
        else quit=true
    }
    if(quit) AlertDialog(onDismissRequest={quit=false},title={Text("Leave this voyage?")},
        text={Text("Returning to the harbour ends this match.")},
        confirmButton={TextButton(onClick={quit=false;race=null;page="home"}){Text("Leave match")}},
        dismissButton={TextButton(onClick={quit=false}){Text("Keep playing")}})
    val r=race
    LaunchedEffect(page,r,quit){
        if(quit || r==null) return@LaunchedEffect
        if(page=="story"){ delay(3200); page="match"; return@LaunchedEffect }
        if(page!="match") return@LaunchedEffect
        val cpu=r.who!=0
        when(r.phase){
            Phase.Panorama -> {delay(1150);race=r.copy(phase=Phase.Zoom)}
            Phase.Zoom -> {delay(1000);race=r.copy(phase=Phase.Ready)}
            Phase.Ready -> if(r.p.skip){
                delay(650);race=r.edit(r.who,r.p.copy(skip=false)).copy(phase=Phase.Wrap,note="The mire held ${names[r.who]} for this turn.")
            } else if(cpu){delay(750);race=r.cpuGear()}
            Phase.Walk -> if(cpu || r.routes().size==1){
                delay(330);race=r.step(if(cpu) r.cpuStep() else r.routes().first())
            }
            Phase.Quiz -> if(cpu){
                delay(950)
                val q=r.q!!
                val correct=Random.nextInt(100)<(if(q.missed==null) 67 else 78)
                race=r.answer(if(correct) q.key else q.choices.first { it!=q.key && it!=q.missed })
            }
            Phase.Market -> if(cpu){
                delay(700)
                val item=Gear.values().filter { it.price<=r.p.cash && it !in r.p.bag }.randomOrNull()
                race=if(item==null) r.copy(phase=Phase.Wrap) else r.buy(item)
            }
            Phase.Wrap -> if(cpu){delay(1050);race=r.next()}
            Phase.End -> Unit
        }
        Unit
    }
 
    Surface(color=Color(0xfffff5dc),modifier=Modifier.fillMaxSize()){
        Column(Modifier.fillMaxSize().safeDrawingPadding().padding(14.dp),
            verticalArrangement=Arrangement.spacedBy(6.dp)){
            when(page){
                "home","setup","story" -> {
                    Box(Modifier.fillMaxWidth().weight(1f)){ Island(null,false,false){} }
                    Text(TITLE,color=ink,fontSize=32.sp)
                    when(page){
                        "home" -> {
                            Text("Gather fuel before the caldera breaks. The richest fuel hold takes the jet pod.")
                            Button(onClick={page="setup"}){Text("Start game")}
                        }
                        "setup" -> {
                            Text("Rival crews")
                            Row { for(i in 1..3) Choice(i.toString(),cpus==i){cpus=i} }
                            Text("Match length")
                            Row { for((n,label) in listOf(10 to "Quick",15 to "Standard",25 to "Long"))
                                Choice("$n · $label",length==n){length=n} }
                            Button(onClick=::start){Text("Launch voyage")}
                        }
                        else -> {
                            var flare by remember { mutableStateOf(false) }
                            LaunchedEffect(Unit){ while(true){delay(450);flare=!flare} }
                            val glow by animateFloatAsState(if(flare) 1f else .3f,tween(420),label="beacon")
                            Canvas(Modifier.fillMaxWidth().height(22.dp)){
                                drawCircle(Color(0xffff752e).copy(alpha=glow),size.height*.46f,Offset(size.width/2,size.height/2))
                            }
                            Text("Ash at the beacon! Fuel tanks are washing ashore. You have $length turns to fill the escape pod.")
                            Button(onClick={page="match"}){Text("Skip briefing")}
                        }
                    }
                }
                else -> if(r!=null){
                    if(r.phase==Phase.End){
                        val high=r.crew.maxOf { it.fuel }
                        Text("The caldera breaks!",style=MaterialTheme.typography.headlineMedium)
                        Text("The jet pod lifts off. The raft crews ride the tide home.")
                        r.crew.indices.sortedByDescending { r.crew[it].fuel }.forEach { i ->
                            val ride=if(r.crew[i].fuel==high) "Jet pod" else "Inflatable raft"
                            Text("${names[i]} · $ride · ${r.crew[i].fuel} fuel")
                        }
                        Button(onClick={page="setup";race=null}){Text("New voyage")}
                    } else {
                        var wide by rememberSaveable { mutableStateOf(false) }
                        Row(verticalAlignment=Alignment.CenterVertically){
                            Text("Turn ${r.turn}/${r.limit}",Modifier.weight(1f),style=MaterialTheme.typography.titleLarge)
                            TextButton(onClick={wide=!wide}){Text(if(wide)"Follow" else "Island view")}
                        }
                        r.crew.forEachIndexed { i,p ->
                            Text("${if(i==r.who) "▶" else "  "} ${i+1} · ${names[i]}     ${p.fuel} fuel   ·   ${p.cash} credits",
                                color=colors[i],fontSize=14.sp)
                        }
                        val pick=r.phase==Phase.Walk && r.who==0 && r.routes().size>1
                        Box(Modifier.fillMaxWidth().weight(1f)){
                            Island(r,wide || r.phase==Phase.Panorama,pick){race=r.step(it)}
                        }
                        Text("◆ Fuel    ? Math    + Shop    • Trail",color=ink,fontSize=13.sp)
                        Column(Modifier.fillMaxWidth().heightIn(max=230.dp).verticalScroll(rememberScrollState())){
                            Text("${names[r.who]} · ${r.note}",color=ink)
                            if(r.dice.isNotBlank()) Text("Dice: ${r.dice}     Steps left: ${r.steps}")
                            when(r.phase){
                                Phase.Panorama,Phase.Zoom -> Text("From the reef to the starting pier…")
                                Phase.Ready -> if(r.who==0 && !r.p.skip) Row {
                                    Button(onClick={race=r.roll()}){Text("Roll dice")}
                                    TextButton(enabled=!r.used && r.p.bag.isNotEmpty(),onClick={gearMenu=true}){Text("Use gadget")}
                                }
                                Phase.Walk -> if(pick){
                                    Text("Tap a glowing stop or choose its number.")
                                    Row { r.routes().forEach { i -> TextButton(onClick={race=r.step(i)}){Text("#${i+1}")} } }
                                }
                                Phase.Quiz -> {
                                    val q=r.q!!
                                    Text("${q.text} = ?   ·   Try ${if(q.missed==null) 1 else 2}/2")
                                    Row { q.choices.forEach { v -> TextButton(enabled=r.who==0 && v!=q.missed,
                                        onClick={race=r.answer(v)}){Text(v.toString())} } }
                                }
                                Phase.Market -> if(r.who==0){
                                    Text("Outfitter · Choose one tool")
                                    Gear.values().forEach { g -> TextButton(enabled=r.p.cash>=g.price,
                                        onClick={race=r.buy(g)}){Text("${g.title} · ${g.price} credits\n${g.effect}")} }
                                    TextButton(onClick={race=r.copy(phase=Phase.Wrap)}){Text("Sail on")}
                                }
                                Phase.Wrap -> if(r.who==0) Button(onClick={race=r.next()}){Text("Finish turn")}
                                Phase.End -> Unit
                            }
                        }
                        if(gearMenu) AlertDialog(onDismissRequest={gearMenu=false;targetGear=null},
                            title={Text(targetGear?.let{"Choose a rival"} ?: "Use one tool before rolling")},
                            text={Column{
                                val g=targetGear
                                if(g!=null) r.targets(g).forEach { i -> TextButton(onClick={
                                    race=r.use(g,i);gearMenu=false;targetGear=null}){Text(names[i])} }
                                else r.p.bag.distinct().forEach { item ->
                                    val targeted=item==Gear.Snare || item==Gear.Siphon
                                    TextButton(enabled=!targeted || r.targets(item).isNotEmpty(),onClick={
                                        if(targeted) targetGear=item else {race=r.use(item);gearMenu=false}
                                    }){Text(item.title)}
                                }
                            }},confirmButton={TextButton(onClick={gearMenu=false;targetGear=null}){Text("Close")}})
                    }
                }
            }
        }
    }
}
@Composable private fun Choice(label:String,selected:Boolean,click:()->Unit){
    FilterChip(selected=selected,onClick=click,label={Text(label,fontSize=12.sp)})
}

@Composable private fun Island(r:Race?,wide:Boolean,pick:Boolean,onStep:(Int)->Unit){
    val player=board[r?.p?.pos ?: 0]
    val follow=r!=null && !wide
    val zoom by animateFloatAsState(if(follow) 1.45f else 1f,tween(850),label="camera zoom")
    val cx by animateFloatAsState(if(follow) player.x.coerceIn(.35f,.65f) else .5f,tween(650),label="east")
    val cy by animateFloatAsState(if(follow) player.y.coerceIn(.35f,.65f) else .5f,tween(650),label="south")
    fun point(x:Float,y:Float,w:Float,h:Float):Offset {
        val unit=min(w,h)*zoom
        return Offset(w/2+(x-cx)*unit,h/2+(y-cy)*unit)
    }
    val offered=if(pick) r!!.routes() else emptyList()
    Canvas(Modifier.fillMaxSize().background(sea,RoundedCornerShape(16.dp))
        .pointerInput(r,zoom,cx,cy){detectTapGestures { tap ->
            val nearest=offered.minByOrNull { i ->
                val p=board[i];(point(p.x,p.y,size.width.toFloat(),size.height.toFloat())-tap).getDistance()
            }
            if(nearest!=null){
                val p=board[nearest]
                if((point(p.x,p.y,size.width.toFloat(),size.height.toFloat())-tap).getDistance()<28.dp.toPx()) onStep(nearest)
            }
        }}){
        val u=min(size.width,size.height)*zoom
        fun at(x:Float,y:Float)=point(x,y,size.width,size.height)
        fun loc(i:Int)=at(board[i].x,board[i].y)
        fun land(radius:Float,color:Color){
            val path=Path()
            for(i in 0..72){
                val a=i*Math.PI/36
                val radiusHere=radius*(1+.036*sin(5*a)+.023*cos(9*a))
                val p=at((.5+cos(a)*radiusHere).toFloat(),(.5+sin(a)*radiusHere).toFloat())
                if(i==0)path.moveTo(p.x,p.y) else path.lineTo(p.x,p.y)
            }
            path.close();drawPath(path,color)
        }
        land(.486f,Color(0xff308981));land(.46f,gold);land(.426f,Color(0xff78ab6b))
        val crater=at(.50f,.49f)
        drawCircle(Color(0xff976e53),u*.15f,crater)
        drawCircle(Color(0xff633f38),u*.103f,crater)
        drawCircle(Color(0xfffa7836),u*.065f,crater)
        for((i,p) in board.withIndex()) for(j in p.links) if(i<j){
            drawLine(Color(0xff957754),loc(i),loc(j),u*.025f)
            drawLine(Color(0xfff4dfa6),loc(i),loc(j),u*.014f)
        }
        val paint=Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign=Paint.Align.CENTER;isFakeBoldText=true }
        fun glyph(text:String,c:Offset,s:Float){
            paint.textSize=s;paint.color=android.graphics.Color.WHITE
            drawContext.canvas.nativeCanvas.drawText(text,c.x,c.y-(paint.ascent()+paint.descent())/2,paint)
        }
        for(i in board.indices){
            val c=loc(i)
            if(i in offered)drawCircle(gold,u*.044f,c)
            drawCircle(if(i in shops)Color(0xff865125) else ink,u*.031f,c)
            glyph(when {i in offered -> (i+1).toString(); i==r?.cache -> "◆"; i in shops -> "+";i in maths -> "?"; else -> "·"},c,u*.039f)
            if(i==r?.cache) drawCircle(gold,u*.013f,c+Offset(u*.023f,-u*.028f))
        }
        r?.crew?.indices?.groupBy { r.crew[it].pos }?.forEach { (tile,ids) ->
            ids.forEachIndexed { n,i ->
                val c=loc(tile)+Offset((n-(ids.size-1)/2f)*u*.04f,u*.04f)
                drawCircle(colors[i],u*.023f,c);glyph((i+1).toString(),c,u*.032f)
            }
        }
    }
}
