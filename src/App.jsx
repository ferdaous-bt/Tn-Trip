import { useState, useEffect, useRef } from "react";
import { TN, F, F2 } from "./constants/theme";
import { SLIDES } from "./constants/slides";
import { CATS, ML } from "./constants/categories";
import { REGIONS, PROFILES, COMPS, SEASONS, ZONES } from "./constants/data";
import { PL } from "./constants/places";
import Logo from "./components/Logo";
import Carousel from "./components/Carousel";
import { initDatabase, getTripsByUserId, createTrip, updateTrip, deleteTrip } from "./utils/database";
import { signUp, login, logout, getSession } from "./utils/auth";






// Zone definitions for AI mode

// Distance (km) between region centers - for geographic planning
var RDIST={};
(function(){
  REGIONS.forEach(function(a){REGIONS.forEach(function(b){
    var d=Math.sqrt(Math.pow((a.lt-b.lt)*111,2)+Math.pow((a.lg-b.lg)*90,2));
    RDIST[a.id+":"+b.id]=Math.round(d);
  })});
})();
function regDist(a,b){return RDIST[a+":"+b]||999}

function scoreAll(profs,comp){
  var mw={};profs.forEach(function(k){var w=PROFILES[k].w;Object.keys(w).forEach(function(t){mw[t]=(mw[t]||0)+w[t]})});
  Object.keys(mw).forEach(function(t){mw[t]/=(profs.length||1)});
  return PL.map(function(s){
    var sc=(mw[s.cat]||.5)*30+s.rt*10;if(s.hid)sc+=10;
    if(comp==="couple"&&(s.cat==="beach"||s.cat==="restaurant"))sc+=8;
    if(comp==="guide"&&(s.cat==="attraction"||s.cat==="mosque"))sc+=12;
    if(comp==="amis"&&s.cat==="beach")sc+=10;
    return Object.assign({},s,{sc:Math.round(Math.max(0,sc)*10)/10});
  }).sort(function(a,b){return b.sc-a.sc});
}

// Haversine-like distance in km between two spots
function spotDist(a,b){
  if(!a||!b||!a.lt||!b.lt)return 999;
  return Math.sqrt(Math.pow((a.lt-b.lt)*111,2)+Math.pow((b.lg-a.lg)*90*Math.cos(a.lt*Math.PI/180),2));
}

function aiPlan(profs,comp,nD,wBk,wLu,wDi,zones){
  var MAX_D=40; // 40km max entre spots
  var all=scoreAll(profs,comp);
  // Merge regions from all selected zones (deduplicated)
  var zArr=Array.isArray(zones)?zones:zones?[zones]:["all"];
  var zoneRegs=[];
  zArr.forEach(function(zk){
    var zDef=ZONES[zk]||ZONES.all;
    zDef.regions.forEach(function(r){if(zoneRegs.indexOf(r)<0)zoneRegs.push(r)});
  });
  // Filter by merged regions
  var pool=all.filter(function(s){return zoneRegs.indexOf(s.r)>=0});
  var acts=pool.filter(function(s){return!s.meal&&s.cat!=="hotel"});
  var bkfs=pool.filter(function(s){return s.meal==="breakfast"});
  var luns=pool.filter(function(s){return s.meal==="lunch"});
  var dins=pool.filter(function(s){return s.meal==="dinner"});
  var hotels=pool.filter(function(s){return s.cat==="hotel"});
  // Shuffle top acts for variety (keep scoring but randomize within tiers)
  var tier1=acts.slice(0,Math.ceil(acts.length*.4));
  var tier2=acts.slice(Math.ceil(acts.length*.4));
  for(var ti=tier1.length-1;ti>0;ti--){var tj=Math.floor(Math.random()*(ti+1));var tt=tier1[ti];tier1[ti]=tier1[tj];tier1[tj]=tt}
  acts=tier1.concat(tier2);
  // Used tracker - NEVER reset, each spot used only once across all days
  var used={};
  var usedMeals={};
  var days=[];
  for(var d=0;d<nD;d++){
    // Pick seed: highest scoring unused activity
    var seed=null;
    for(var si=0;si<acts.length;si++){
      if(!used[acts[si].id]){seed=acts[si];used[acts[si].id]=true;break}
    }
    if(!seed)break; // No more unused spots - stop adding days
    // Build cluster: find nearby spots within MAX_D km of seed
    var cluster=[seed];
    var center={lt:seed.lt,lg:seed.lg};
    var beachUsed=seed.cat==="beach";
    // Candidates: sorted by distance to seed, ONLY unused
    var cands=acts.filter(function(s){return!used[s.id]});
    cands.sort(function(a,b){return spotDist(a,center)-spotDist(b,center)});
    for(var ci=0;ci<cands.length&&cluster.length<5;ci++){
      // Check max distance to ALL spots already in cluster
      var tooFar=false;
      for(var ck=0;ck<cluster.length;ck++){
        if(spotDist(cands[ci],cluster[ck])>MAX_D){tooFar=true;break}
      }
      if(tooFar)continue;
      if(cands[ci].cat==="beach"){if(beachUsed)continue;beachUsed=true}
      cluster.push(cands[ci]);
      used[cands[ci].id]=true;
    }
    // Sort cluster by nearest-neighbor path
    var ordered=[cluster[0]];var rem=cluster.slice(1);
    while(rem.length){
      var last=ordered[ordered.length-1];
      var best=-1,bestD=Infinity;
      for(var ri=0;ri<rem.length;ri++){
        var dd=spotDist(last,rem[ri]);
        if(dd<bestD){bestD=dd;best=ri}
      }
      ordered.push(rem[best]);rem.splice(best,1);
    }
    // Determine region of majority spots
    var regCount={};
    ordered.forEach(function(s){regCount[s.r]=(regCount[s.r]||0)+1});
    var rid=Object.keys(regCount).sort(function(a,b){return regCount[b]-regCount[a]})[0];
    // Build timeline with meals
    var spots=[];var cm=0;
    // Breakfast: find one near cluster center, not already used
    if(wBk){
      var bkC=bkfs.filter(function(s){return!usedMeals[s.id]&&spotDist(s,center)<MAX_D});
      if(!bkC.length)bkC=bkfs.filter(function(s){return!usedMeals[s.id]});
      if(!bkC.length)bkC=bkfs;
      var bk=bkC[0];
      if(bk){usedMeals[bk.id]=true;spots.push(Object.assign({},bk,{stM:cm,alM:40,tv:0,_ml:"breakfast"}));cm+=55}
    }
    var nAct=ordered.length;
    for(var a=0;a<nAct;a++){
      var sp=ordered[a];
      spots.push(Object.assign({},sp,{stM:cm,alM:Math.min(sp.dur||60,80),tv:12}));
      cm+=Math.min(sp.dur||60,80)+12;
      // Lunch after half
      if(wLu&&a===Math.floor(nAct/2)-1){
        var lnC=luns.filter(function(s){return!usedMeals[s.id]&&spotDist(s,center)<MAX_D});
        if(!lnC.length)lnC=luns.filter(function(s){return!usedMeals[s.id]});
        if(!lnC.length)lnC=luns;
        var ln=lnC[0];
        if(ln){usedMeals[ln.id]=true;spots.push(Object.assign({},ln,{stM:cm,alM:60,tv:10,_ml:"lunch"}));cm+=70}
      }
    }
    // Dinner
    if(wDi){
      var dnC=dins.filter(function(s){return!usedMeals[s.id]&&spotDist(s,center)<MAX_D});
      if(!dnC.length)dnC=dins.filter(function(s){return!usedMeals[s.id]});
      if(!dnC.length)dnC=dins;
      var dn=dnC[0];
      if(dn){usedMeals[dn.id]=true;spots.push(Object.assign({},dn,{stM:cm,alM:75,tv:10,_ml:"dinner"}));cm+=85}
    }
    // Hotel
    var wHo=profs.indexOf("hotelier")>=0;
    if(wHo){
      var htC=hotels.filter(function(s){return spotDist(s,center)<MAX_D});
      if(!htC.length)htC=hotels;
      var ht=htC.length?htC[d%htC.length]:null;
      if(ht){spots.push(Object.assign({},ht,{stM:cm,alM:0,tv:10,_ht:true}));cm+=10}
    }
    days.push({rid:rid,spots:spots});
  }
  return days;
}

function scorePL(rids,profs,comp,sea,avC,iH){
  var mw={};profs.forEach(function(k){var w=PROFILES[k].w;Object.keys(w).forEach(function(t){mw[t]=(mw[t]||0)+w[t]})});
  Object.keys(mw).forEach(function(t){mw[t]/=(profs.length||1)});
  var ridArr=Array.isArray(rids)?rids:[rids];
  return PL.filter(function(p){return ridArr.indexOf(p.r)>=0}).map(function(s){
    var sc=(mw[s.cat]||.5)*30+s.rt*10;if(s.hid&&iH)sc+=12;if(s.hid&&!iH)sc-=10;
    if(sea&&s.sn&&s.sn.indexOf(sea)>=0)sc+=15;else if(sea)sc-=20;
    if(avC)sc-=Math.min(1,s.cr||0)*20;
    if(comp==="couple"&&(s.cat==="beach"||s.cat==="restaurant"))sc+=8;
    if(comp==="guide"&&(s.cat==="attraction"||s.cat==="mosque"))sc+=12;
    return Object.assign({},s,{sc:Math.round(Math.max(0,sc)*10)/10});
  }).sort(function(a,b){return b.sc-a.sc});
}

// Leaflet Interactive Map
function LeafletMap(props){
  var containerRef=useRef(null);
  var mapRef=useRef(null);
  var lt=props.lt||34.5,lg=props.lg||9.5,z=props.z||7,h=props.h||220;
  var spots=props.spots||[];var rid=props.activeRid;
  var spotsKey=spots.map(function(s){return s.id||s.n}).join(",");

  useEffect(function(){
    if(!document.getElementById("leaflet-css")){
      var link=document.createElement("link");link.id="leaflet-css";link.rel="stylesheet";
      link.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }
    function initMap(){
      if(!containerRef.current||!window.L)return;
      if(mapRef.current){mapRef.current.remove();mapRef.current=null}
      var map=window.L.map(containerRef.current,{zoomControl:true,attributionControl:false}).setView([lt,lg],z);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18}).addTo(map);
      var colors=["#c17f3e","#1a6985","#27ae60","#c0392b","#8b5cf6","#e67e22","#16a085","#2c3e50"];
      var bounds=[];
      spots.forEach(function(s,i){
        var isMeal=!!s._ml;var isHotel=!!s._ht;
        var mCol=isMeal?"#e67e22":isHotel?"#8b5cf6":colors[i%8];
        var mIcon=isMeal?"🍽":isHotel?"🏨":(i+1);
        var icon=window.L.divIcon({className:"",html:'<div style="width:24px;height:24px;border-radius:50%;background:'+mCol+';color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">'+mIcon+"</div>",iconSize:[24,24],iconAnchor:[12,12]});
        window.L.marker([s.lt,s.lg],{icon:icon}).addTo(map).bindPopup("<b>"+s.n+"</b><br>"+((s.d||"").substring(0,60)));
        bounds.push([s.lt,s.lg]);
      });
      if(bounds.length>1)map.fitBounds(bounds,{padding:[30,30]});
      else if(bounds.length===1)map.setView(bounds[0],13);
      mapRef.current=map;
      setTimeout(function(){map.invalidateSize()},200);
    }
    if(window.L){initMap()}
    else{
      if(!document.getElementById("leaflet-js")){
        var script=document.createElement("script");script.id="leaflet-js";
        script.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
        script.onload=initMap;document.head.appendChild(script);
      }else{var check=setInterval(function(){if(window.L){clearInterval(check);initMap()}},100)}
    }
    return function(){if(mapRef.current){mapRef.current.remove();mapRef.current=null}};
  },[lt,lg,z,spotsKey,rid]);

  return <div ref={containerRef} style={{width:"100%",height:h,borderRadius:14,border:"2px solid "+TN.bd,overflow:"hidden",zIndex:1}}/>;
}

export default function App(){
  var _u=useState(null),user=_u[0],setUser=_u[1];
  var _am=useState("login"),aMode=_am[0],setAMode=_am[1];
  var _an=useState(""),aN=_an[0],setAN=_an[1];
  var _ae=useState(""),aE=_ae[0],setAE=_ae[1];
  var _ap=useState(""),aP=_ap[0],setAP=_ap[1];
  var _aerr=useState(""),aErr=_aerr[0],setAErr=_aerr[1];
  var _udb=useState({}),uDB=_udb[0],setUDB=_udb[1];
  var _vw=useState("home"),vw=_vw[0],setVw=_vw[1];
  var _regs=useState(["tunis"]),regs=_regs[0],setRegs=_regs[1];
  var _profs=useState([]),profs=_profs[0],setProfs=_profs[1];
  var _comp=useState("couple"),comp=_comp[0],setComp=_comp[1];
  var _nD=useState(3),nD=_nD[0],setND=_nD[1];
  var _zone=useState(["all"]),zones=_zone[0],setZones=_zone[1];
  var _bud=useState(500),bud=_bud[0],setBud=_bud[1];
  var _wBk=useState(false),wBk=_wBk[0],setWBk=_wBk[1];
  var _wLu=useState(false),wLu=_wLu[0],setWLu=_wLu[1];
  var _wDi=useState(false),wDi=_wDi[0],setWDi=_wDi[1];
  var _sea=useState("printemps"),sea=_sea[0],setSea=_sea[1];
  var _sH=useState(9),sH=_sH[0],setSH=_sH[1];
  var _avC=useState(true),avC=_avC[0],setAvC=_avC[1];
  var _iH=useState(true),iH=_iH[0],setIH=_iH[1];
  var _scored=useState([]),scored=_scored[0],setScored=_scored[1];
  var _sel=useState(new Set()),sel=_sel[0],setSel=_sel[1];
  var _catF=useState("all"),catF=_catF[0],setCatF=_catF[1];
  var _itin=useState(null),itin=_itin[0],setItin=_itin[1];
  var _aD=useState(0),aD=_aD[0],setAD=_aD[1];
  var _trips=useState([]),trips=_trips[0],setTrips=_trips[1];
  var _aT=useState(null),aT=_aT[0],setAT=_aT[1];
  var _gP=useState(0),gP=_gP[0],setGP=_gP[1];
  var _gT=useState(""),gT=_gT[0],setGT=_gT[1];
  var _editTrip=useState(null),editTrip=_editTrip[0],setEditTrip=_editTrip[1];

  // Initialize database and check for existing session
  useEffect(function(){
    initDatabase().then(function(){
      console.log("Database initialized");
    });

    var session = getSession();
    if (session) {
      setUser(session);
    }
  }, []);

  // Load trips when user logs in
  useEffect(function(){
    if (user && user.userId) {
      getTripsByUserId(user.userId).then(function(userTrips){
        var formattedTrips = userTrips.map(function(trip){
          return {
            id: trip.id,
            nm: trip.title,
            dy: trip.itinerary ? trip.itinerary.length : 0,
            sp: trip.itinerary ? trip.itinerary.reduce(function(sum, day){
              return sum + (day.spots ? day.spots.filter(function(s){return !s._ml && !s._ht}).length : 0);
            }, 0) : 0,
            it: trip.itinerary ? {days: trip.itinerary, stats: trip.preferences} : null,
            dt: new Date(trip.created_at).toLocaleDateString()
          };
        });
        setTrips(formattedTrips);
      });
    }
  }, [user]);

  var rObj=REGIONS.find(function(r){return r.id===regs[0]});
  var rc=function(r){if(Array.isArray(r))return PL.filter(function(p){return r.indexOf(p.r)>=0}).length;return PL.filter(function(p){return p.r===r}).length};
  var cats=Array.from(new Set(PL.filter(function(p){return regs.indexOf(p.r)>=0}).map(function(p){return p.cat})));
  var togP=function(k){setProfs(function(p){return p.indexOf(k)>=0?p.filter(function(x){return x!==k}):p.concat([k])})};
  var togS=function(id){setSel(function(p){var n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})};
  var doAuth=function(){
    if(aMode==="signup"){
      signUp(aN, aE, aP).then(function(result){
        if(result.success){
          setUser(result.user);
          setAErr("");
        } else {
          setAErr(result.error);
        }
      });
    } else {
      login(aE, aP).then(function(result){
        if(result.success){
          setUser(result.user);
          setAErr("");
        } else {
          setAErr(result.error);
        }
      });
    }
  };

  var aiGo=function(){
    if(!profs.length)return;setVw("ai_load");setGP(0);
    var steps=[{p:10,t:"Analyse des preferences..."},{p:28,t:"Selection des regions..."},{p:45,t:"Meilleurs spots par region..."},{p:60,t:"Restaurants & cafes..."},{p:78,t:"Petit-dej, Dejeuner, Diner..."},{p:92,t:"Repartition "+nD+" jours..."},{p:100,t:"Votre voyage est pret!"}];
    steps.forEach(function(s,i){setTimeout(function(){setGP(s.p);setGT(s.t)},250+i*400)});
    setTimeout(function(){
      var plan=aiPlan(profs,comp,nD,wBk,wLu,wDi,zones);
      var allS=[];plan.forEach(function(d){d.spots.forEach(function(s){allS.push(s)})});
      setItin({days:plan,stats:{total:allS.filter(function(s){return!s._ml&&!s._ht}).length,meals:allS.filter(function(s){return!!s._ml}).length,hotels:allS.filter(function(s){return!!s._ht}).length,cost:allS.reduce(function(a,s){return a+s.cost},0),days:nD},all:allS});
      setVw("ai_result");setAD(0);
    },250+7*400+350);
  };

  var manGo=function(){var s=scorePL(regs,profs,comp,sea,avC,iH);setScored(s);setSel(new Set());setCatF("all");setVw("man_sel")};
  var manBuild=function(){
    if(!sel.size)return;setVw("man_load");setGP(0);
    setTimeout(function(){setGP(30);setGT("Calcul des distances...")},200);
    setTimeout(function(){setGP(60);setGT("Regroupement geographique...")},500);
    setTimeout(function(){setGP(90);setGT("Optimisation itineraire...")},800);
    setTimeout(function(){setGP(100);setGT("Pret!")},1000);
    setTimeout(function(){
      var chosen=scored.filter(function(s){return sel.has(s.id)});
      // Haversine-like distance in km
      function distKm(a,b){var dLt=(a.lt-b.lt)*111;var dLg=(a.lg-b.lg)*90;return Math.sqrt(dLt*dLt+dLg*dLg)}
      // Group spots into geographic clusters (max ~40km / ~30min within cluster)
      var used=new Array(chosen.length).fill(false);
      var clusters=[];
      // Sort by latitude (north to south) then longitude for consistent ordering
      var sorted=chosen.map(function(s,i){return{idx:i,s:s}}).sort(function(a,b){return b.s.lt-a.s.lt||(a.s.lg-b.s.lg)});
      for(var i=0;i<sorted.length;i++){
        if(used[sorted[i].idx])continue;
        var cluster=[sorted[i].s];used[sorted[i].idx]=true;
        var center={lt:sorted[i].s.lt,lg:sorted[i].s.lg};
        // Find nearby spots within 40km (~30min)
        for(var j=i+1;j<sorted.length;j++){
          if(used[sorted[j].idx])continue;
          var d=distKm(center,sorted[j].s);
          if(d<=40){
            cluster.push(sorted[j].s);used[sorted[j].idx]=true;
            center={lt:(center.lt+sorted[j].s.lt)/2,lg:(center.lg+sorted[j].s.lg)/2};
          }
        }
        clusters.push(cluster);
      }
      // Within each cluster: nearest-neighbor route (no back-and-forth)
      function optimizeRoute(spots){
        if(spots.length<=1)return spots;
        var remaining=spots.slice();var route=[remaining.shift()];
        while(remaining.length){
          var last=route[route.length-1];var bestIdx=0;var bestDist=999;
          for(var r=0;r<remaining.length;r++){
            var dd=distKm(last,remaining[r]);
            if(dd<bestDist){bestDist=dd;bestIdx=r}
          }
          route.push(remaining.splice(bestIdx,1)[0]);
        }
        return route;
      }
      clusters=clusters.map(optimizeRoute);
      // Distribute clusters across days
      var days=[];
      if(clusters.length<=nD){
        // Each cluster gets its own day(s)
        for(var c=0;c<clusters.length;c++){var cReg=clusters[c][0]?.r||regs[0];days.push({rid:cReg,spots:clusters[c]})}
        // Fill remaining days if needed
        while(days.length<nD&&days.length<chosen.length){
          var biggest=0;
          for(var bb=1;bb<days.length;bb++){if(days[bb].spots.length>days[biggest].spots.length)biggest=bb}
          if(days[biggest].spots.length<=1)break;
          var half=Math.ceil(days[biggest].spots.length/2);
          var split=days[biggest].spots.splice(half);
          days.push({rid:days[biggest]?.rid||regs[0],spots:split});
        }
      }else{
        // More clusters than days: merge closest clusters
        while(clusters.length>nD){
          var minD=9999;var mi=-1;var mj=-1;
          for(var a=0;a<clusters.length;a++){for(var b=a+1;b<clusters.length;b++){
            var cA=clusters[a][0];var cB=clusters[b][0];var dd=distKm(cA,cB);
            if(dd<minD){minD=dd;mi=a;mj=b}
          }}
          clusters[mi]=optimizeRoute(clusters[mi].concat(clusters[mj]));
          clusters.splice(mj,1);
        }
        for(var c=0;c<clusters.length;c++){var cReg=clusters[c][0]?.r||regs[0];days.push({rid:cReg,spots:clusters[c]})}
      }
      // Cap at max 5 spots per day, split overflow
      var capped=[];
      days.forEach(function(day){
        if(day.spots.length<=5){capped.push(day)}
        else{
          for(var ci=0;ci<day.spots.length;ci+=5){
            capped.push({rid:day.rid,spots:day.spots.slice(ci,ci+5)});
          }
        }
      });
      days=capped;
      // Max 1 beach per day — move excess beaches to other days or remove
      days.forEach(function(day){
        var bCount=0;
        day.spots=day.spots.filter(function(s){
          if(s.cat==="beach"){bCount++;return bCount<=1}
          return true;
        });
      });
      // Add timing to each day's spots
      days=days.map(function(day){
        var cm=0;
        return{rid:day.rid,spots:day.spots.map(function(s,j){
          var tv=j>0?15:0;var du=Math.min(s.dur||60,120);
          var r=Object.assign({},s,{stM:cm,alM:du,tv:tv});cm+=du+tv;return r;
        })};
      });
      var cost=chosen.reduce(function(a,s){return a+s.cost},0);
      setItin({days:days,stats:{total:chosen.length,meals:0,cost:cost,days:days.length},all:chosen});
      setND(days.length);setVw("man_result");setAD(0);
    },1200);
  };

  var saveTrip=function(){
    if(!itin || !user || !user.userId) return;

    var rIcons=itin.days.map(function(d){return REGIONS.find(function(x){return x.id===d.rid})?.icon||""}).join("");
    var tripTitle = rIcons+" "+nD+"j";

    // Save to database
    createTrip(user.userId, {
      title: tripTitle,
      region: zones.join(","),
      start_date: null,
      end_date: null,
      budget: bud.toString(),
      preferences: {
        profiles: profs,
        companion: comp,
        zones: zones,
        meals: {breakfast: wBk, lunch: wLu, dinner: wDi},
        season: sea,
        stats: itin.stats
      },
      profile: profs.join(","),
      itinerary: itin.days
    }).then(function(result){
      if(result.success) {
        // Add to local state
        setTrips(function(p){
          return [{
            id: result.id,
            nm: tripTitle,
            dy: nD,
            sp: itin.stats.total,
            it: itin,
            dt: new Date().toLocaleDateString()
          }].concat(p);
        });
        setVw("trips");
      }
    });
  };

  var updateTrip_=function(){
    if(!itin || !editTrip || !user || !user.userId) return;

    var rIcons=itin.days.map(function(d){return REGIONS.find(function(x){return x.id===d.rid})?.icon||""}).join("");
    var tripTitle = rIcons+" "+nD+"j";

    updateTrip(editTrip.id, {
      title: tripTitle,
      region: regs.join(","),
      start_date: null,
      end_date: null,
      budget: bud.toString(),
      preferences: {
        profiles: profs,
        companion: comp,
        zones: regs,
        meals: {breakfast: wBk, lunch: wLu, dinner: wDi},
        season: sea,
        stats: itin.stats
      },
      profile: profs.join(","),
      itinerary: itin.days
    }).then(function(result){
      if(result.success) {
        // Update local state
        setTrips(function(p){
          return p.map(function(t){
            if(t.id===editTrip.id){
              return {
                id: editTrip.id,
                nm: tripTitle,
                dy: nD,
                sp: itin.stats.total,
                it: itin,
                dt: t.dt
              };
            }
            return t;
          });
        });
        setEditTrip(null);
        setVw("trips");
      }
    });
  };

  var cs={background:TN.card,borderRadius:20,padding:24,border:"1px solid "+TN.bd,boxShadow:TN.shadow,transition:"all 0.3s ease"};
  var ls={fontSize:11,fontWeight:700,color:TN.tM,textTransform:"uppercase",letterSpacing:1.2,marginBottom:10,fontFamily:F};
  var btn={padding:"16px 24px",borderRadius:12,border:"none",fontSize:15,fontWeight:600,fontFamily:F,cursor:"pointer",color:"#fff",background:"linear-gradient(135deg,"+TN.pr+" 0%, "+TN.pD+" 100%)",boxShadow:TN.shadowMd,width:"100%",transition:"all 0.3s ease",transform:"translateY(0)"};
  var back=function(fn){return <button onClick={fn} style={{fontSize:13,color:TN.pr,background:"none",border:"none",cursor:"pointer",fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",gap:4,transition:"all 0.2s ease"}}>← Retour</button>};
  var LoadUI=<div style={Object.assign({},cs,{textAlign:"center",marginTop:32,padding:40})}><div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,"+TN.pr+" 0%, "+TN.pD+" 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:'#fff',margin:"0 auto 20px",boxShadow:TN.shadowMd}}>AI</div><div style={{fontSize:18,fontWeight:600,fontFamily:F,color:TN.tx,marginBottom:4}}>{gT||"Chargement..."}</div><div style={{height:8,borderRadius:12,background:TN.sand,overflow:"hidden",marginTop:20,border:"1px solid "+TN.bd}}><div style={{height:"100%",borderRadius:12,width:gP+"%",background:"linear-gradient(90deg,"+TN.pr+" 0%, "+TN.ac+" 100%)",transition:"width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",boxShadow:"0 0 8px "+TN.pr+"40"}}/></div></div>;
  var colors=["#c17f3e","#1a6985","#27ae60","#c0392b","#8b5cf6","#e67e22","#16a085","#2c3e50"];

  var DayView=function(props){
    var day=props.day,di=props.di,dayR=REGIONS.find(function(r){return r.id===day.rid});
    return <div style={cs}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <div style={{fontSize:24,fontWeight:700,fontFamily:F,color:TN.tx}}>Jour {di+1}</div>
        {dayR&&<span style={{fontSize:12,fontWeight:600,background:"linear-gradient(135deg, "+TN.sand+" 0%, #ffe8cc 100%)",color:TN.pD,borderRadius:24,padding:"6px 16px",border:"1px solid "+TN.sD,boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>{dayR.icon} {dayR.name}</span>}
        <span style={{fontSize:11,color:TN.tM,marginLeft:"auto",fontWeight:500}}>{day.spots.filter(function(s){return!s._ml}).length} spots</span>
      </div>
      {day.spots.map(function(site,i){
        var h=sH+Math.floor(site.stM/60),m=site.stM%60;var isMeal=!!site._ml;var isHotel=!!site._ht;
        var bgCol=isMeal?"#fef9f0":isHotel?"#f0e6ff":"transparent";
        var circCol=isMeal?"#e67e22":isHotel?"#8b5cf6":colors[i%8];
        var circIcon=isMeal?"🍽":isHotel?"🏨":(i+1);
        return <div key={site.id+"-"+i} style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:i<day.spots.length-1?16:0,paddingBottom:i<day.spots.length-1?16:0,borderBottom:i<day.spots.length-1?"1px solid "+TN.bd:"none"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:48,flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:600,color:circCol,fontFamily:F}}>{isHotel?"Nuit":h+":"+(m<10?"0"+m:m)}</div>
            <div style={{width:28,height:28,borderRadius:"50%",background:circCol,color:"#fff",fontSize:isMeal||isHotel?12:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",marginTop:4,border:"3px solid #fff",boxShadow:TN.shadowMd}}>{circIcon}</div>
            {i<day.spots.length-1&&<div style={{width:2,height:20,background:"linear-gradient(180deg, "+circCol+" 0%, "+TN.bd+" 100%)",marginTop:4,borderRadius:1}}/>}
          </div>
          <div style={{flex:1,background:bgCol,borderRadius:(isMeal||isHotel)?16:0,padding:(isMeal||isHotel)?"14px 16px":"0",border:(isMeal||isHotel)?"1px solid "+(isMeal?"#ffe8cc":"#e9d5ff"):"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              {isMeal&&<span style={{fontSize:10,fontWeight:600,color:"#d97706",background:"linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",borderRadius:8,padding:"4px 10px",border:"1px solid #fbbf24"}}>{ML[site._ml]}</span>}
              {isHotel&&<span style={{fontSize:10,fontWeight:600,color:"#7c3aed",background:"linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",borderRadius:8,padding:"4px 10px",border:"1px solid #c084fc"}}>🏨 Hébergement 5★</span>}
              <span style={{fontSize:15,fontWeight:600,fontFamily:F,color:TN.tx}}>{site.n}</span>
              <span style={{fontSize:14}}>{CATS[site.cat]?.i}</span>
            </div>
            <div style={{fontSize:11,color:TN.tM,marginTop:6,lineHeight:1.6}}>{site.d}</div>
            <div style={{display:"flex",gap:10,marginTop:8,fontSize:10,color:TN.tM,fontWeight:500}}>{!isHotel&&<span style={{background:TN.sand,padding:"4px 10px",borderRadius:8,border:"1px solid #ffe8cc"}}>⏱ {site.alM}min</span>}<span style={{background:site.cost?TN.aL:TN.sand+"80",padding:"4px 10px",borderRadius:8,border:"1px solid "+(site.cost?"#90caf9":"#e0e0e0")}}>{site.cost?site.cost+"TND":"Gratuit"}</span><span style={{background:"linear-gradient(135deg, #fff9c4 0%, #ffeb3b30 100%)",padding:"4px 10px",borderRadius:8,border:"1px solid #fdd835"}}>⭐ {site.rt}</span>{i>0&&day.spots[i-1]&&site.lt&&day.spots[i-1].lt?<span style={{background:TN.card,padding:"4px 10px",borderRadius:8,border:"1px solid "+TN.bd}}>🚗 {Math.round(Math.sqrt(Math.pow((site.lt-day.spots[i-1].lt)*111,2)+Math.pow((site.lg-day.spots[i-1].lg)*90,2)))}km</span>:null}</div>
          </div>
        </div>})}
    </div>;
  };

  // AUTH
  if(!user)return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg, #E89BA3 0%, #A04A52 50%, #E89BA3 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F2,color:"#fff"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:560,padding:32}}>
        <div style={{background:"rgba(255,255,255,0.98)",borderRadius:24,padding:"48px 40px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",backdropFilter:"blur(10px)"}}>
          <div style={{textAlign:"center",marginBottom:32}}><Logo size={72}/><h1 style={{fontSize:32,fontWeight:700,fontFamily:F,color:TN.tx,margin:"12px 0 4px",letterSpacing:"-0.5px"}}>TUN Trip</h1><p style={{fontSize:14,color:TN.tM,fontFamily:F}}>Découvrez les perles de la Tunisie</p></div>
          <div style={{display:"flex",marginBottom:24,background:TN.sand,borderRadius:14,padding:4}}>
            {["login","signup"].map(function(m){return <button key={m} onClick={function(){setAMode(m);setAErr("")}} style={{flex:1,padding:"12px 20px",border:"none",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:F2,background:aMode===m?"#fff":"transparent",color:aMode===m?TN.tx:TN.tM,borderRadius:12,boxShadow:aMode===m?TN.shadow:"none",transition:"all 0.3s ease"}}>{m==="login"?"Connexion":"Inscription"}</button>})}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {aMode==="signup"&&<input value={aN} onChange={function(e){setAN(e.target.value);setAErr("")}} placeholder="Votre nom" style={{padding:"16px 18px",borderRadius:14,border:"2px solid "+TN.bd,background:TN.bg,color:TN.tx,fontSize:15,fontFamily:F2,outline:"none",transition:"all 0.3s ease"}} minLength="2" required/>}
            <input value={aE} onChange={function(e){setAE(e.target.value);setAErr("")}} placeholder="Email" type="email" style={{padding:"16px 18px",borderRadius:14,border:"2px solid "+TN.bd,background:TN.bg,color:TN.tx,fontSize:15,fontFamily:F2,outline:"none",transition:"all 0.3s ease"}} required/>
            <input value={aP} onChange={function(e){setAP(e.target.value);setAErr("")}} placeholder="Mot de passe" type="password" style={{padding:"16px 18px",borderRadius:14,border:"2px solid "+TN.bd,background:TN.bg,color:TN.tx,fontSize:15,fontFamily:F2,outline:"none",transition:"all 0.3s ease"}} onKeyDown={function(e){if(e.key==="Enter")doAuth()}} minLength="6" required/>
            {aErr&&<div style={{fontSize:12,color:"#dc2626",background:"#fee2e2",borderRadius:12,padding:"12px 16px",fontWeight:500,border:"1px solid #fecaca"}}>{aErr}</div>}
            <button onClick={doAuth} style={Object.assign({},btn,{marginTop:8})}>{aMode==="login"?"Se connecter":"Créer mon compte"}</button>
          </div>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:TN.bg,fontFamily:F2,color:TN.tx}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{background:"linear-gradient(135deg, #E89BA3 0%, #A04A52 100%)",padding:"16px 20px",position:"sticky",top:0,zIndex:50,boxShadow:TN.shadowMd}}>
        <div style={{maxWidth:640,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div onClick={function(){setVw("home")}} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",transition:"transform 0.2s ease"}}><Logo size={36}/><span style={{fontSize:20,fontWeight:700,fontFamily:F,color:"#fff",letterSpacing:"-0.5px"}}>TUN Trip</span></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:13,color:"#fff",fontWeight:500}}>{user.name || user.nm}</span><button onClick={function(){logout();setUser(null);setTrips([])}} style={{fontSize:11,padding:"8px 16px",borderRadius:10,border:"2px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.15)",cursor:"pointer",color:"#fff",fontWeight:600,backdropFilter:"blur(10px)",transition:"all 0.3s ease"}}>Déconnexion</button></div>
        </div>
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(255,255,255,0.98)",borderTop:"1px solid "+TN.bd,display:"flex",justifyContent:"center",gap:60,padding:"12px 0 16px",zIndex:50,boxShadow:"0 -4px 16px rgba(0,0,0,0.08)",backdropFilter:"blur(10px)"}}>
        {[{v:"home",i:"✨",l:"Nouveau"},{v:"trips",i:"📋",l:"Mes Voyages"}].map(function(t){return <button key={t.v} onClick={function(){setVw(t.v)}} style={{background:"none",border:"none",cursor:"pointer",textAlign:"center",color:vw===t.v?TN.pr:TN.tL,transition:"all 0.3s ease",transform:vw===t.v?"scale(1.05)":"scale(1)"}}><div style={{fontSize:24,marginBottom:4}}>{t.i}</div><div style={{fontSize:10,fontWeight:600,letterSpacing:"0.5px"}}>{t.l}</div></button>})}
      </div>

      <div style={{maxWidth:640,margin:"0 auto",padding:"16px 16px 80px"}}>

        {vw==="home"&&<div>
          <Carousel/>
          <div style={{textAlign:"center",marginBottom:20}}>
            <p style={{fontSize:14,color:TN.pr,fontWeight:600,fontFamily:F,letterSpacing:.8,margin:"0 0 16px"}}>Découvrez les perles de la Tunisie</p>
            <div style={{background:TN.card,borderRadius:20,padding:"20px 24px",border:"1px solid "+TN.bd,textAlign:"left",marginBottom:20,boxShadow:TN.shadow}}>
              <p style={{fontSize:13,color:TN.tM,lineHeight:1.8,margin:0}}>La Tunisie, terre de contrastes et berceau de civilisations millénaires, offre une mosaïque exceptionnelle de paysages et de cultures. Du bleu éclatant de Sidi Bou Saïd aux dunes dorées du Sahara, des vestiges romains majestueux classés UNESCO aux médinas authentiques préservées, chaque destination révèle un patrimoine unique. Explorez 262 sites soigneusement sélectionnés à travers 11 régions, alliant histoire antique, nature préservée et traditions méditerranéennes vivantes.</p>
            </div>
            <h2 style={{fontSize:28,fontWeight:700,fontFamily:F,color:TN.tx,margin:"0 0 8px",letterSpacing:"-0.5px"}}>Bienvenue, {user.name || user.nm}</h2>
            <p style={{fontSize:14,color:TN.tM,fontFamily:F}}>Comment souhaitez-vous explorer ?</p>
          </div>

          <div onClick={function(){setVw("ai_prefs")}} style={{background:"linear-gradient(135deg, #E89BA3 0%, #A04A52 100%)",borderRadius:24,padding:28,cursor:"pointer",marginBottom:16,position:"relative",overflow:"hidden",boxShadow:TN.shadowLg,transition:"transform 0.3s ease,box-shadow 0.3s ease",border:"none"}}>
            <div style={{position:"absolute",inset:0,opacity:.1,backgroundImage:"repeating-linear-gradient(45deg,#fff 0,#fff 2px,transparent 2px,transparent 16px)"}}/>
            <div style={{position:"relative"}}><div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}><div style={{width:52,height:52,borderRadius:16,background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff",backdropFilter:"blur(10px)"}}>AI</div><div><div style={{fontSize:22,fontWeight:700,fontFamily:F,color:"#fff",letterSpacing:"-0.3px"}}>Générez moi un Plan</div><div style={{fontSize:11,color:"rgba(255,255,255,0.9)",background:"rgba(255,255,255,0.2)",borderRadius:8,padding:"4px 12px",display:"inline-block",fontWeight:600,marginTop:4}}>✨ Recommandé</div></div></div>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.95)",lineHeight:1.7,margin:0}}>L'IA choisit les régions et les meilleurs spots pour chaque jour selon vos préférences.</p></div>
          </div>
          <div onClick={function(){setVw("man_prefs")}} style={Object.assign({},cs,{cursor:"pointer",padding:28,borderWidth:2,transition:"all 0.3s ease",borderColor:TN.bd})}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}><div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg, "+TN.sand+" 0%, #ffe8cc 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:TN.pD,border:"2px solid "+TN.sD}}>M</div><div><div style={{fontSize:22,fontWeight:700,fontFamily:F,color:TN.tx,letterSpacing:"-0.3px"}}>Voyage sur Mesure</div><div style={{fontSize:12,color:TN.tM,marginTop:2}}>Sélection manuelle par région</div></div></div>
            <p style={{fontSize:14,color:TN.tM,lineHeight:1.7,margin:0}}>Choisissez une région, filtrez par catégorie, composez votre itinéraire personnalisé.</p>
          </div>
        </div>}

        {/* AI PREFS — ONLY: preferences + companions + days */}
        {vw==="ai_prefs"&&<div>
          {back(function(){setVw("home")})}
          <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:22,fontWeight:700,color:"#fff",background:"linear-gradient(135deg, #E89BA3 0%, #A04A52 100%)",width:56,height:56,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",boxShadow:TN.shadowMd}}>AI</div><h2 style={{fontSize:30,fontWeight:700,fontFamily:F,color:TN.tx,margin:"12px 0 6px",letterSpacing:"-0.5px"}}>Add Your Trip Plan</h2><p style={{fontSize:14,color:TN.tM,fontFamily:F}}>Dites-nous vos envies, on fait le reste</p></div>

          <div style={cs}><div style={ls}>🎭 Qu'est-ce qui vous passionne ?</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{Object.keys(PROFILES).map(function(k){var p=PROFILES[k];var s=profs.indexOf(k)>=0;return <button key={k} onClick={function(){togP(k)}} style={{padding:"14px 20px",borderRadius:32,cursor:"pointer",border:s?"2px solid "+TN.pr:"2px solid "+TN.bd,background:s?"linear-gradient(135deg,"+TN.pr+" 0%, "+TN.pD+" 100%)":"#fff",fontSize:14,fontWeight:600,color:s?"#fff":TN.tM,boxShadow:s?TN.shadowMd:"none",transition:"all 0.3s ease",transform:s?"scale(1.02)":"scale(1)"}}>{p.i} {p.l}</button>})}</div>
          </div>

          <div style={Object.assign({},cs,{marginTop:16})}><div style={ls}>👥 Avec qui voyagez-vous ?</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{COMPS.map(function(c){return <button key={c.k} onClick={function(){setComp(c.k)}} style={{padding:"14px 20px",borderRadius:16,cursor:"pointer",border:comp===c.k?"2px solid "+TN.ac:"2px solid "+TN.bd,background:comp===c.k?"linear-gradient(135deg, "+TN.aL+" 0%, #e3f2fd 100%)":"#fff",fontSize:14,fontWeight:600,color:comp===c.k?TN.ac:TN.tM,transition:"all 0.3s ease",boxShadow:comp===c.k?TN.shadow:"none",transform:comp===c.k?"scale(1.02)":"scale(1)"}}>{c.i} {c.l}</button>})}</div>
          </div>

          <div style={Object.assign({},cs,{marginTop:14})}><div style={ls}>🗺️ Zones & Régions <span style={{fontSize:8,fontWeight:400,color:TN.tL}}>(choix multiple)</span></div>
            {/* Toggle zone helper */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {Object.keys(ZONES).filter(function(k){return ZONES[k].g==="top"}).map(function(k){var z=ZONES[k];var isSel=zones.indexOf(k)>=0;return <button key={k} onClick={function(){setZones(function(prev){if(k==="all")return["all"];var next=prev.filter(function(x){return x!=="all"&&ZONES[x]?.g==="top"});var idx=next.indexOf(k);if(idx>=0){next.splice(idx,1);return next.length?next:["all"]}next.push(k);return next})}} style={{padding:"10px 8px",borderRadius:12,cursor:"pointer",border:isSel?"2.5px solid "+TN.tile:"1.5px solid "+TN.bd,background:isSel?"linear-gradient(135deg,"+TN.aL+",#fff)":TN.card,textAlign:"center",transition:"all .15s"}}>
                <div style={{fontSize:18}}>{z.i}</div>
                <div style={{fontSize:11,fontWeight:700,color:isSel?TN.tile:TN.tM,marginTop:2}}>{z.l}</div>
                <div style={{fontSize:8,color:TN.tL}}>{z.regions.length} régions</div>
              </button>})}
            </div>
            <div style={{fontSize:9,fontWeight:700,color:TN.tL,textTransform:"uppercase",letterSpacing:1,marginTop:10,marginBottom:6}}>Ou choisir des régions</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
              {Object.keys(ZONES).filter(function(k){return ZONES[k].g==="reg"}).map(function(k){var z=ZONES[k];var rc=PL.filter(function(p){return z.regions.indexOf(p.r)>=0}).length;var isSel=zones.indexOf(k)>=0;return <button key={k} onClick={function(){setZones(function(prev){var next=prev.filter(function(x){return x!=="all"&&ZONES[x]?.g!=="top"});var idx=next.indexOf(k);if(idx>=0){next.splice(idx,1);return next.length?next:["all"]}next.push(k);return next})}} style={{padding:"8px 4px",borderRadius:10,cursor:"pointer",border:isSel?"2px solid "+TN.pr:"1px solid "+TN.bd,background:isSel?"linear-gradient(135deg,"+TN.sand+",#fff)":TN.card,textAlign:"center",transition:"all .15s"}}>
                <div style={{fontSize:14}}>{z.i}</div>
                <div style={{fontSize:9,fontWeight:700,color:isSel?TN.pD:TN.tM,marginTop:1}}>{z.l}</div>
                <div style={{fontSize:7,color:TN.tL}}>{rc} lieux</div>
              </button>})}
            </div>
            <div style={{fontSize:9,color:TN.tM,marginTop:6}}>✅ {zones.indexOf("all")>=0?"Toutes les régions":zones.map(function(k){return ZONES[k]?.i||""}).join(" ")+" sélectionnée"+(zones.length>1?"s":"")}</div>
          </div>

          <div style={Object.assign({},cs,{marginTop:16})}><div style={ls}>📅 Combien de jours ?</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{[1,2,3,5,7,10,14].map(function(d){return <button key={d} onClick={function(){setND(d)}} style={{width:56,height:56,borderRadius:16,cursor:"pointer",border:nD===d?"2px solid "+TN.pr:"2px solid "+TN.bd,background:nD===d?"linear-gradient(135deg,"+TN.pr+" 0%,"+TN.pD+" 100%)":"#fff",color:nD===d?"#fff":TN.tM,fontSize:22,fontWeight:700,fontFamily:F,transition:"all 0.3s ease",boxShadow:nD===d?TN.shadowMd:"none",transform:nD===d?"scale(1.05)":"scale(1)"}}>{d}</button>})}</div>
            <div style={{fontSize:12,color:TN.tM,marginTop:12,lineHeight:1.7,background:TN.sand+"60",padding:"12px 16px",borderRadius:12}}>{nD} jour{nD>1?"s":""} — destinations proches (max 40km), max 5 spots/jour</div>
          </div>

          <div style={Object.assign({},cs,{marginTop:16})}><div style={ls}>💰 Budget maximum</div>
            <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:8}}>
              <span style={{fontSize:36,fontWeight:700,fontFamily:F,color:TN.pr,letterSpacing:"-1px"}}>{bud}</span>
              <span style={{fontSize:16,color:TN.tM,fontWeight:600}}>TND</span>
              <span style={{fontSize:14,color:TN.tL,marginLeft:"auto",background:TN.sand,padding:"6px 14px",borderRadius:10,border:"1px solid "+TN.sD}}>≈ {Math.round(bud*0.29)} EUR</span>
            </div>
            <input type="range" min={50} max={6000} step={50} value={bud} onChange={function(e){setBud(Number(e.target.value))}} style={{width:"100%",marginTop:16,accentColor:TN.pr,height:8,borderRadius:8}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:TN.tM,marginTop:8,fontWeight:500}}><span>50 TND</span><span>6000 TND</span></div>
          </div>

          <div style={Object.assign({},cs,{marginTop:16})}><div style={ls}>🍽️ Inclure les repas ?</div>
            <div style={{display:"flex",gap:10}}>
              {[{k:"bk",v:wBk,fn:setWBk,i:"🌅",l:"Petit-déj"},{k:"lu",v:wLu,fn:setWLu,i:"☀️",l:"Déjeuner"},{k:"di",v:wDi,fn:setWDi,i:"🌙",l:"Dîner"}].map(function(m){return <button key={m.k} onClick={function(){m.fn(!m.v)}} style={{flex:1,padding:"16px 10px",borderRadius:16,cursor:"pointer",border:m.v?"2px solid "+TN.gn:"2px solid "+TN.bd,background:m.v?"linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)":"#fff",textAlign:"center",transition:"all 0.3s ease",boxShadow:m.v?TN.shadow:"none",transform:m.v?"scale(1.02)":"scale(1)"}}>
                <div style={{fontSize:20,marginBottom:4}}>{m.i}</div>
                <div style={{fontSize:11,fontWeight:600,color:m.v?TN.gn:TN.tL}}>{m.l}</div>
              </button>})}
            </div>
          </div>

          {(wBk||wLu||wDi||profs.indexOf("hotelier")>=0)&&<div style={{background:"linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%)",borderRadius:16,padding:18,border:"2px solid #ffe699",marginTop:16,boxShadow:TN.shadow}}>
            <div style={{fontSize:14,fontWeight:700,color:"#d97706",marginBottom:8}}>📋 Inclus dans votre plan</div>
            <div style={{display:"flex",gap:12,fontSize:12,color:TN.tM,flexWrap:"wrap",fontWeight:500}}>
              {wBk&&<span style={{background:"#fff",padding:"6px 12px",borderRadius:10,border:"1px solid #fbbf24"}}>🌅 Petit-déj</span>}{wLu&&<span style={{background:"#fff",padding:"6px 12px",borderRadius:10,border:"1px solid #fbbf24"}}>☀️ Déjeuner</span>}{wDi&&<span style={{background:"#fff",padding:"6px 12px",borderRadius:10,border:"1px solid #fbbf24"}}>🌙 Dîner</span>}{profs.indexOf("hotelier")>=0&&<span style={{background:"#fff",padding:"6px 12px",borderRadius:10,border:"1px solid #fbbf24"}}>🏨 Hôtel 5★</span>}
            </div>
          </div>}
          {!wBk&&!wLu&&!wDi&&profs.indexOf("hotelier")<0&&<div style={{background:"linear-gradient(135deg, "+TN.aL+" 0%, #e3f2fd 100%)",borderRadius:16,padding:18,border:"2px solid #90caf9",marginTop:16,boxShadow:TN.shadow}}>
            <div style={{fontSize:13,color:TN.ac,fontWeight:600}}>ℹ️ Plan destinations uniquement</div>
          </div>}

          <button onClick={aiGo} disabled={!profs.length} style={Object.assign({},btn,{marginTop:20,opacity:profs.length?1:.5,fontSize:17,padding:"18px 24px",cursor:profs.length?"pointer":"not-allowed"})}>{profs.length?"🚀 Créer mon voyage":"Sélectionnez au moins un style"}</button>
        </div>}

        {vw==="ai_load"&&<div>{back(function(){setVw("ai_prefs")})}{LoadUI}</div>}

        {/* AI RESULT */}
        {vw==="ai_result"&&itin&&<div>
          {back(function(){setVw("ai_prefs")})}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {profs.map(function(k){return <span key={k} style={{fontSize:11,fontWeight:600,background:"linear-gradient(135deg, "+TN.sand+" 0%, #ffe8cc 100%)",color:TN.pD,borderRadius:24,padding:"6px 14px",border:"1px solid "+TN.sD,boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>{PROFILES[k].i} {PROFILES[k].l}</span>})}
            <span style={{fontSize:11,fontWeight:600,background:"linear-gradient(135deg, "+TN.aL+" 0%, #e3f2fd 100%)",color:TN.ac,borderRadius:24,padding:"6px 14px",border:"1px solid #90caf9",boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>{COMPS.find(function(c){return c.k===comp})?.i} {COMPS.find(function(c){return c.k===comp})?.l}</span>
            <span style={{fontSize:11,fontWeight:600,background:"linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)",color:"#d97706",borderRadius:24,padding:"6px 14px",border:"1px solid #fdd835",boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>{nD}j</span>
            <span style={{fontSize:11,fontWeight:600,background:"linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",color:TN.tile,borderRadius:24,padding:"6px 14px",border:"1px solid #64b5f6",boxShadow:"0 2px 4px rgba(0,0,0,0.05)"}}>{zones.indexOf("all")>=0?"🇹🇳 Toute la Tunisie":zones.map(function(k){return(ZONES[k]?.i||"")+" "+(ZONES[k]?.l||"")}).join(" · ")}</span>
          </div>
          {(function(){var dr=REGIONS.find(function(r){return r.id===(itin.days[aD]?.rid)});return <LeafletMap lt={dr?.lt||34.5} lg={dr?.lg||9.5} z={dr?10:7} h={240} spots={itin.days[aD]?.spots||[]} activeRid={itin.days[aD]?.rid}/>})()}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,marginBottom:12}}>
            <div><div style={{fontSize:26,fontWeight:700,fontFamily:F,color:TN.tx,letterSpacing:"-0.5px"}}>Votre voyage</div><div style={{fontSize:13,color:TN.tM,marginTop:4,fontWeight:500}}>{itin.stats.total} spots{itin.stats.meals?" · "+itin.stats.meals+" repas":""}{itin.stats.hotels?" · "+itin.stats.hotels+" hôtels":""} · ~{itin.stats.cost} TND (≈{Math.round(itin.stats.cost*0.29)} EUR)</div></div>
            <button onClick={saveTrip} style={{padding:"12px 20px",borderRadius:12,border:"none",background:"linear-gradient(135deg, "+TN.gn+" 0%, #43a047 100%)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:TN.shadow,transition:"all 0.3s ease"}}>💾 Sauver</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16,marginTop:12,overflowX:"auto",paddingBottom:4}}>{itin.days.map(function(day,i){var dr=REGIONS.find(function(r){return r.id===day.rid});return <button key={i} onClick={function(){setAD(i)}} style={{padding:"12px 18px",borderRadius:14,border:aD===i?"2px solid "+TN.pD:"2px solid "+TN.bd,background:aD===i?"linear-gradient(135deg, "+TN.pD+" 0%, "+TN.pr+" 100%)":"#fff",color:aD===i?"#fff":TN.tM,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:F,whiteSpace:"nowrap",boxShadow:aD===i?TN.shadowMd:"none",transition:"all 0.3s ease",transform:aD===i?"scale(1.02)":"scale(1)"}}>{dr?.icon} Jour {i+1}</button>})}</div>
          <DayView day={itin.days[aD]} di={aD}/>
          <div style={Object.assign({},cs,{marginTop:16})}>
            <div style={{fontSize:18,fontWeight:700,fontFamily:F,color:TN.tx,marginBottom:12,letterSpacing:"-0.3px"}}>🗺️ Vue d'ensemble</div>
            {itin.days.map(function(day,di){var dr=REGIONS.find(function(r){return r.id===day.rid});return <div key={di} style={{padding:"12px 14px",background:di%2===0?"linear-gradient(135deg, "+TN.sand+"60 0%, #fff 100%)":"#fff",borderRadius:12,marginBottom:8,border:"1px solid "+(di%2===0?TN.sD:TN.bd)}}>
              <span style={{fontSize:14,fontWeight:700,fontFamily:F,color:TN.pD}}>Jour {di+1} {dr?.icon} {dr?.name}: </span>
              <span style={{fontSize:12,color:TN.tM,lineHeight:1.6}}>{day.spots.map(function(s){return(s._ml?"🍽 ":"")+ s.n}).join(" → ")}</span>
            </div>})}
          </div>
          <button onClick={function(){setVw("home")}} style={{width:"100%",padding:"16px 24px",borderRadius:14,border:"2px solid "+TN.bd,fontSize:14,fontWeight:600,cursor:"pointer",color:TN.tM,background:"#fff",marginTop:16,fontFamily:F,transition:"all 0.3s ease"}}>← Nouveau voyage</button>
        </div>}

        {/* MANUAL PREFS */}
        {vw==="man_prefs"&&<div>
          {back(function(){setVw("home")})}
          <div style={{textAlign:"center",marginBottom:14}}><h2 style={{fontSize:24,fontWeight:700,fontFamily:F,color:TN.pD,margin:"4px 0"}}>Selection manuelle</h2><p style={{fontSize:12,color:TN.tL,fontStyle:"italic",fontFamily:F}}>Personnalisez chaque detail</p></div>

          <div style={cs}><div style={ls}>🗓️ Saison de voyage</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>{Object.keys(SEASONS).map(function(k){var s=SEASONS[k];return <button key={k} onClick={function(){setSea(k)}} style={{padding:"10px 6px",borderRadius:12,cursor:"pointer",textAlign:"center",border:sea===k?"2px solid "+TN.pr:"1px solid "+TN.bd,background:sea===k?TN.sand:TN.card}}><div style={{fontSize:18}}>{s.i}</div><div style={{fontSize:11,fontWeight:700,color:sea===k?TN.pD:TN.tM,marginTop:2}}>{s.l}</div><div style={{fontSize:8,color:TN.tL}}>{s.s}</div></button>})}</div>
          </div>

          <div style={Object.assign({},cs,{marginTop:12})}><div style={ls}>Destinations <span style={{fontSize:8,fontWeight:400,color:TN.tL}}>({rc(regs)} lieux, choix multiple)</span></div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{REGIONS.map(function(r){var isSel=regs.indexOf(r.id)>=0;return <button key={r.id} onClick={function(){setRegs(function(prev){var idx=prev.indexOf(r.id);if(idx>=0){var next=prev.filter(function(x){return x!==r.id});return next.length?next:[r.id]}return prev.concat([r.id])})}} style={{padding:"7px 11px",borderRadius:10,cursor:"pointer",border:isSel?"2px solid "+TN.pr:"1px solid "+TN.bd,background:isSel?TN.sand:TN.card,fontSize:10,fontWeight:600,color:isSel?TN.pD:TN.tM}}>{r.icon} {r.name}</button>})}</div>
          {rObj&&<div style={{marginTop:8}}><LeafletMap lt={rObj.lt} lg={rObj.lg} z={regs.length>2?7:rObj.id==="sud_est"||rObj.id==="sud_ouest"?8:10} h={200} spots={PL.filter(function(p){return regs.indexOf(p.r)>=0}).slice(0,15)} activeRid={regs[0]}/></div>}
          {<div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>{regs.map(function(rid){var rr=REGIONS.find(function(x){return x.id===rid});return rr?rr.subs.map(function(s){return <span key={s} style={{fontSize:9,background:TN.sand,borderRadius:6,padding:"3px 8px",color:TN.pD,fontWeight:600}}>{s}</span>}):null})}</div>}
          </div>

          <div style={Object.assign({},cs,{marginTop:12})}><div style={ls}>👥 Compagnons</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{COMPS.map(function(c){return <button key={c.k} onClick={function(){setComp(c.k)}} style={{padding:"8px 14px",borderRadius:10,cursor:"pointer",border:comp===c.k?"2px solid "+TN.ac:"1px solid "+TN.bd,background:comp===c.k?TN.aL:TN.card,fontSize:11,fontWeight:600,color:comp===c.k?TN.ac:TN.tM}}>{c.i} {c.l}</button>})}</div>
          </div>

          <div style={Object.assign({},cs,{marginTop:12})}><div style={ls}>🎭 Style de voyage <span style={{color:TN.pr}}>(multi-sélection)</span></div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{Object.keys(PROFILES).map(function(k){var p=PROFILES[k];var s=profs.indexOf(k)>=0;return <button key={k} onClick={function(){togP(k)}} style={{padding:"7px 13px",borderRadius:24,cursor:"pointer",border:s?"2px solid "+TN.pr:"1px solid "+TN.bd,background:s?TN.sand:TN.card,fontSize:11,fontWeight:600,color:s?TN.pD:TN.tM}}>{p.i} {p.l}</button>})}</div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <div style={cs}>
              <div style={{fontSize:9,fontWeight:700,color:TN.tL,textTransform:"uppercase"}}>🕐 Heure de départ</div>
              <div style={{display:"flex",alignItems:"baseline",gap:2,marginTop:4}}><span style={{fontSize:28,fontWeight:700,fontFamily:F,color:TN.pD}}>{sH}</span><span style={{fontSize:14,color:TN.tL}}>h00</span></div>
              <input type="range" min={6} max={14} value={sH} onChange={function(e){setSH(Number(e.target.value))}} style={{width:"100%",accentColor:TN.pr}}/>
            </div>
            <div style={cs}>
              <div style={{fontSize:9,fontWeight:700,color:TN.tL,textTransform:"uppercase"}}>📅 Nombre de jours</div>
              <div style={{display:"flex",alignItems:"baseline",gap:2,marginTop:4}}><span style={{fontSize:28,fontWeight:700,fontFamily:F,color:TN.pD}}>{nD}</span><span style={{fontSize:14,color:TN.tL}}> jour{nD>1?"s":""}</span></div>
              <input type="range" min={1} max={14} value={nD} onChange={function(e){setND(Number(e.target.value))}} style={{width:"100%",accentColor:TN.pr}}/>
            </div>
          </div>

          <div style={Object.assign({},cs,{marginTop:12})}>
            <div style={{fontSize:9,fontWeight:700,color:TN.tL,textTransform:"uppercase"}}>💰 Budget max</div>
            <div style={{display:"flex",alignItems:"baseline",gap:4,marginTop:4}}><span style={{fontSize:28,fontWeight:700,fontFamily:F,color:TN.pD}}>{bud}</span><span style={{fontSize:14,color:TN.tL}}>TND</span><span style={{fontSize:12,color:TN.tM,marginLeft:6}}>≈ {Math.round(bud*0.29)} EUR</span></div>
            <input type="range" min={50} max={6000} step={50} value={bud} onChange={function(e){setBud(Number(e.target.value))}} style={{width:"100%",accentColor:TN.pr}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:TN.tL}}><span>50 TND</span><span>6000 TND</span></div>
          </div>

          <div style={Object.assign({},cs,{marginTop:12})}><div style={{fontSize:9,fontWeight:700,color:TN.tL,textTransform:"uppercase"}}>🍽️ Inclure les repas</div>
            <div style={{display:"flex",gap:6,marginTop:6}}>
              {[{k:"bk",v:wBk,fn:setWBk,i:"🌅",l:"Petit-déj"},{k:"lu",v:wLu,fn:setWLu,i:"☀️",l:"Déjeuner"},{k:"di",v:wDi,fn:setWDi,i:"🌙",l:"Dîner"}].map(function(m){return <button key={m.k} onClick={function(){m.fn(!m.v)}} style={{flex:1,padding:"8px 4px",borderRadius:10,cursor:"pointer",border:m.v?"2px solid "+TN.gn:"1.5px solid "+TN.bd,background:m.v?"#eafaf1":TN.card,textAlign:"center",fontSize:10,fontWeight:700,color:m.v?TN.gn:TN.tL}}>
                {m.i} {m.l} {m.v?"✓":""}
              </button>})}
            </div>
          </div>

          <div style={{display:"flex",gap:6,marginTop:12}}>
            <button onClick={function(){setAvC(!avC)}} style={{flex:1,padding:"10px 12px",borderRadius:12,cursor:"pointer",border:avC?"2px solid "+TN.pr:"1px solid "+TN.bd,background:avC?TN.sand:TN.card,fontSize:11,fontWeight:600,color:avC?TN.pD:TN.tM,display:"flex",alignItems:"center",gap:6}}>Eviter la foule {avC?"✓":""}</button>
            <button onClick={function(){setIH(!iH)}} style={{flex:1,padding:"10px 12px",borderRadius:12,cursor:"pointer",border:iH?"2px solid "+TN.pr:"1px solid "+TN.bd,background:iH?TN.sand:TN.card,fontSize:11,fontWeight:600,color:iH?TN.pD:TN.tM,display:"flex",alignItems:"center",gap:6}}>Pepites cachees {iH?"✓":""}</button>
          </div>

          <button onClick={manGo} disabled={!profs.length} style={Object.assign({},btn,{marginTop:14,opacity:profs.length?1:.5})}>Voir les {rc(regs)} spots</button>
        </div>}

        {vw==="man_sel"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div><div style={{fontSize:20,fontWeight:700,fontFamily:F,color:TN.pD}}>Choisissez vos spots</div><div style={{fontSize:11,color:TN.tL}}>{sel.size} selectionne(s) · {regs.map(function(r){return REGIONS.find(function(x){return x.id===r})?.name||""}).join(", ")}</div></div>
            {back(function(){setVw("man_prefs")})}
          </div>
          <div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto",paddingBottom:4}}>
            <button onClick={function(){setCatF("all")}} style={{padding:"6px 14px",borderRadius:20,border:catF==="all"?"2px solid "+TN.pD:"1px solid "+TN.bd,background:catF==="all"?TN.pD:TN.card,color:catF==="all"?"#fff":TN.tM,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>All</button>
            {cats.map(function(c){return <button key={c} onClick={function(){setCatF(c)}} style={{padding:"6px 14px",borderRadius:20,border:catF===c?"2px solid "+TN.pD:"1px solid "+TN.bd,background:catF===c?TN.pD:TN.card,color:catF===c?"#fff":TN.tM,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{CATS[c].i} {CATS[c].l}</button>})}
          </div>
          {rObj&&rObj.subs.map(function(sub){
            var sites=scored.filter(function(s){return s.sub===sub&&(catF==="all"||s.cat===catF)});if(!sites.length)return null;
            return <div key={sub} style={{marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,fontFamily:F,color:TN.pD,marginBottom:6}}>📌 {sub}</div>
              {sites.map(function(site){var sl=sel.has(site.id);var inS=site.sn&&site.sn.indexOf(sea)>=0;
                return <div key={site.id} onClick={function(){togS(site.id)}} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:14,cursor:"pointer",background:sl?TN.sand:TN.card,border:sl?"2px solid "+TN.pr:"1px solid "+TN.bd,marginBottom:6,opacity:inS?1:.45}}>
                  <div style={{width:36,height:36,borderRadius:10,background:sl?TN.pr+"15":TN.sand,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{CATS[site.cat].i}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,fontFamily:F,color:TN.tx}}>{site.hid?"✨ ":""}{site.n}{!inS?" ⚠️":""}</div><div style={{fontSize:9,color:TN.tL}}>{CATS[site.cat].l} · ⭐{site.rt} · Score {site.sc}{site.meal?" · "+ML[site.meal]:""}</div></div>
                  <div style={{width:22,height:22,borderRadius:"50%",border:"2px solid "+(sl?TN.pr:TN.bd),background:sl?TN.pr:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:800}}>{sl?"✓":""}</div>
                </div>})}
            </div>})}
          {sel.size>0&&<div style={{background:"#e8f4f8",borderRadius:10,padding:"8px 12px",marginBottom:8,border:"1px solid #b8d8e8"}}>
            <div style={{fontSize:10,color:TN.ac,fontWeight:600}}>🛣️ Optimisation géographique activée</div>
            <div style={{fontSize:9,color:TN.tM,marginTop:2}}>Les spots seront regroupés par proximité (max ~40km / ~30min) et ordonnés pour éviter les allers-retours.</div>
          </div>}
          <button onClick={manBuild} disabled={!sel.size} style={Object.assign({},btn,{position:"sticky",bottom:64,opacity:sel.size?1:.5})}>Creer ({sel.size} spots · {nD}j)</button>
        </div>}

        {vw==="man_load"&&LoadUI}

        {vw==="edit_sel"&&<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div><div style={{fontSize:20,fontWeight:700,fontFamily:F,color:TN.pD}}>Modifier le voyage</div><div style={{fontSize:11,color:TN.tL}}>{sel.size} spot(s) sélectionné(s)</div></div>
            {back(function(){setEditTrip(null);setVw("trips")})}
          </div>
          <div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto",paddingBottom:4}}>
            <button onClick={function(){setCatF("all")}} style={{padding:"6px 14px",borderRadius:20,border:catF==="all"?"2px solid "+TN.pD:"1px solid "+TN.bd,background:catF==="all"?TN.pD:TN.card,color:catF==="all"?"#fff":TN.tM,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>All</button>
            {cats.map(function(c){return <button key={c} onClick={function(){setCatF(c)}} style={{padding:"6px 14px",borderRadius:20,border:catF===c?"2px solid "+TN.pD:"1px solid "+TN.bd,background:catF===c?TN.pD:TN.card,color:catF===c?"#fff":TN.tM,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{CATS[c].i} {CATS[c].l}</button>})}
          </div>
          {rObj&&rObj.subs.map(function(sub){
            var sites=scored.filter(function(s){return s.sub===sub&&(catF==="all"||s.cat===catF)});if(!sites.length)return null;
            return <div key={sub} style={{marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,fontFamily:F,color:TN.pD,marginBottom:6}}>📌 {sub}</div>
              {sites.map(function(site){var sl=sel.has(site.id);var inS=site.sn&&site.sn.indexOf(sea)>=0;
                return <div key={site.id} onClick={function(){togS(site.id)}} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:14,cursor:"pointer",background:sl?TN.sand:TN.card,border:sl?"2px solid "+TN.pr:"1px solid "+TN.bd,marginBottom:6,opacity:inS?1:.45}}>
                  <div style={{width:36,height:36,borderRadius:10,background:sl?TN.pr+"15":TN.sand,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{CATS[site.cat].i}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,fontFamily:F,color:TN.tx}}>{site.hid?"✨ ":""}{site.n}{!inS?" ⚠️":""}</div><div style={{fontSize:9,color:TN.tL}}>{CATS[site.cat].l} · ⭐{site.rt} · Score {site.sc}{site.meal?" · "+ML[site.meal]:""}</div></div>
                  <div style={{width:22,height:22,borderRadius:"50%",border:"2px solid "+(sl?TN.pr:TN.bd),background:sl?TN.pr:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:800}}>{sl?"✓":""}</div>
                </div>})}
            </div>})}
          {sel.size>0&&<div style={{background:"#e8f4f8",borderRadius:10,padding:"8px 12px",marginBottom:8,border:"1px solid #b8d8e8"}}>
            <div style={{fontSize:10,color:TN.ac,fontWeight:600}}>🛣️ Optimisation géographique activée</div>
            <div style={{fontSize:9,color:TN.tM,marginTop:2}}>Les spots seront regroupés par proximité (max ~40km / ~30min) et ordonnés pour éviter les allers-retours.</div>
          </div>}
          <button onClick={manBuild} disabled={!sel.size} style={Object.assign({},btn,{position:"sticky",bottom:64,opacity:sel.size?1:.5})}>Reconstruire ({sel.size} spots · {nD}j)</button>
        </div>}

        {vw==="man_result"&&itin&&<div>
          {back(function(){setVw(editTrip?"edit_sel":"man_sel")})}
          {rObj&&<LeafletMap lt={rObj.lt} lg={rObj.lg} z={regs.length>2?8:10} h={200} spots={itin.days[aD]?.spots||[]} activeRid={regs[0]}/>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,marginBottom:4}}>
            <div><div style={{fontSize:22,fontWeight:700,fontFamily:F,color:TN.pD}}>{rObj?.name}</div><div style={{fontSize:12,color:TN.tL}}>{itin.stats.days}j · {itin.stats.total} spots · {itin.stats.cost} TND (≈{Math.round(itin.stats.cost*0.29)} EUR)</div></div>
            <button onClick={editTrip?updateTrip_:saveTrip} style={{padding:"8px 16px",borderRadius:10,border:"none",background:TN.pr,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>💾 {editTrip?"Mettre à jour":"Sauver"}</button>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:10,marginTop:6}}>{itin.days.map(function(_,i){return <button key={i} onClick={function(){setAD(i)}} style={{padding:"8px 16px",borderRadius:10,border:aD===i?"2px solid "+TN.pD:"1px solid "+TN.bd,background:aD===i?TN.pD:TN.card,color:aD===i?"#fff":TN.tM,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>Jour {i+1}</button>})}</div>
          <DayView day={itin.days[aD]} di={aD}/>
          <button onClick={function(){editTrip?setVw("trips"):setVw("home");setEditTrip(null)}} style={{width:"100%",padding:12,borderRadius:14,border:"2px solid "+TN.bd,fontSize:13,fontWeight:700,cursor:"pointer",color:TN.tM,background:TN.card,marginTop:10,fontFamily:F}}>← {editTrip?"Retour aux voyages":"Nouveau voyage"}</button>
        </div>}

        {vw==="trips"&&<div>
          <h2 style={{fontSize:24,fontWeight:700,fontFamily:F,color:TN.pD,margin:"8px 0 16px"}}>Mes Voyages</h2>
          {!trips.length&&<div style={{textAlign:"center",padding:40,color:TN.tL}}>🧳 Aucun voyage</div>}
          {trips.map(function(t){return <div key={t.id} style={Object.assign({},cs,{marginBottom:10,display:"flex",gap:14,alignItems:"center",justifyContent:"space-between"})}>
            <div onClick={function(){setAT(t);setVw("trip")}} style={{display:"flex",gap:14,alignItems:"center",flex:1,cursor:"pointer"}}>
              <div style={{fontSize:28}}>🧳</div><div><div style={{fontSize:15,fontWeight:700,fontFamily:F,color:TN.pD}}>{t.nm}</div><div style={{fontSize:11,color:TN.tL}}>{t.dy}j · {t.sp} spots · {t.dt}</div></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){
                setEditTrip(t);
                var allSpots=[];t.it.days.forEach(function(d){d.spots.forEach(function(s){if(!s._ml&&!s._ht)allSpots.push(s.id)})});
                setSel(new Set(allSpots));
                setND(t.dy);
                var rids=t.it.days.map(function(d){return d.rid}).filter(function(v,i,a){return a.indexOf(v)===i});
                setRegs(rids);
                var s=scorePL(rids,profs,comp,sea,avC,iH);
                setScored(s);
                setCatF("all");
                setVw("edit_sel");
              }} style={{padding:"8px 12px",borderRadius:10,border:"none",background:TN.pr,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",boxShadow:TN.shadow}}>✏️ Modifier</button>
              <button onClick={function(){if(confirm("Supprimer ce voyage ?")){deleteTrip(t.id).then(function(){setTrips(function(p){return p.filter(function(x){return x.id!==t.id})})})}}} style={{padding:"8px 12px",borderRadius:10,border:"none",background:"#dc2626",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",boxShadow:TN.shadow}}>🗑️ Supprimer</button>
            </div>
          </div>})}
        </div>}

        {vw==="trip"&&aT&&<div>
          {back(function(){setVw("trips")})}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <h2 style={{fontSize:22,fontWeight:700,fontFamily:F,color:TN.pD,margin:0}}>{aT.nm}</h2>
            <button onClick={function(){if(confirm("Supprimer ce voyage ?")){deleteTrip(aT.id).then(function(){setTrips(function(p){return p.filter(function(x){return x.id!==aT.id})});setVw("trips")})}}} style={{padding:"8px 16px",borderRadius:10,border:"none",background:"#dc2626",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:TN.shadow}}>🗑️ Supprimer</button>
          </div>
          {aT.it.days.map(function(day,di){var dr=REGIONS.find(function(r){return r.id===day.rid});return <div key={di} style={Object.assign({},cs,{marginBottom:8})}><div style={{fontSize:15,fontWeight:700,fontFamily:F,color:TN.pD}}>{dr?.icon} Jour {di+1} — {dr?.name}</div><div style={{fontSize:11,color:TN.tM,marginTop:4}}>{day.spots.map(function(s){return s.n}).join(" → ")}</div></div>})}
        </div>}


      </div>
    </div>
  );
}
