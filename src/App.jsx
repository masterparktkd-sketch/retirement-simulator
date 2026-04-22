import { useState, useMemo, useRef, useEffect } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, AreaChart, Area, Line } from "recharts";

const fmt  = v => { const s=v<0?"-":"",a=Math.abs(v); if(a>=1e9)return s+"$"+(a/1e9).toFixed(1)+"B"; if(a>=1e6)return s+"$"+(a/1e6).toFixed(1)+"M"; if(a>=1e3)return s+"$"+(a/1e3).toFixed(0)+"K"; return s+"$"+a.toFixed(0); };
const fmtF = v => { const s=v<0?"-$":"$",a=Math.abs(v); if(a>=1e9)return s+(a/1e9).toFixed(2)+"B"; if(a>=1e6)return s+(a/1e6).toFixed(2)+"M"; if(a>=1e3)return s+(a/1e3).toFixed(0)+"K"; return s+a.toFixed(0); };

const RMD_TABLE={72:27.4,73:26.5,74:25.5,75:24.6,76:23.7,77:22.9,78:22.0,79:21.1,80:20.2,81:19.4,82:18.5,83:17.7,84:16.8,85:16.0,86:15.2,87:14.4,88:13.7,89:12.9,90:12.2,91:11.5,92:10.8,93:10.1,94:9.5,95:8.9,96:8.4,97:7.8,98:7.3,99:6.8,100:6.4};
const getRMDDiv = age => RMD_TABLE[Math.min(Math.max(age,72),100)]||6.4;
const calcMonthlyPmt = (p,r,m) => { if(!r)return p/m; const mr=r/100/12; return p*mr*Math.pow(1+mr,m)/(Math.pow(1+mr,m)-1); };

const F = ({ label, value, onChange, unit, min, max, step=1, hint, prefix, readOnly }) => (
  <div className="mb-2">
    <label className="block text-xs font-semibold text-gray-700 mb-1">
      {label}{hint&&<span className="text-gray-400 font-normal ml-1">{hint}</span>}
    </label>
    <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden focus-within:border-indigo-400 transition-colors">
      {prefix&&<span className="text-gray-400 text-xs pl-3">{prefix}</span>}
      <input type="number" value={value} onChange={e=>onChange&&onChange(parseFloat(e.target.value)||0)}
        min={min} max={max} step={step} readOnly={readOnly}
        className="flex-1 bg-transparent border-none outline-none text-gray-900 text-sm px-3 py-2 read-only:text-gray-400"/>
      {unit&&<span className="text-gray-400 text-xs pr-3 whitespace-nowrap">{unit}</span>}
    </div>
  </div>
);

const Sec = ({ title, expanded, onToggle, badge, children }) => (
  <div className="mb-1">
    <button onClick={onToggle} className="w-full flex items-center justify-between text-xs font-bold text-indigo-500 uppercase tracking-widest py-2 hover:text-indigo-700 transition-colors border-b border-gray-100">
      <span>{title}</span>
      <span className="flex items-center gap-2 normal-case">
        {badge&&<span className="text-emerald-600 font-normal">{badge}</span>}
        <span className="text-gray-400">{expanded?"▲":"▼"}</span>
      </span>
    </button>
    {expanded&&<div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-1 mt-1">{children}</div>}
  </div>
);

const SL = ({ color="text-indigo-500", children }) => <p className={"text-xs font-bold mb-2 mt-3 "+color}>{children}</p>;
const Divider = ({ label, value, color="text-emerald-600" }) => (
  <div className="flex justify-between text-xs mt-1 pt-2 border-t border-gray-200">
    <span className="text-gray-500">{label}</span>
    <span className={"font-bold "+color}>{value}</span>
  </div>
);
const Toggle = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2 mb-2">
    <span className="text-xs text-gray-700">{label}</span>
    <button onClick={()=>onChange(!value)} className={"w-10 h-5 rounded-full transition-colors relative border-none "+(value?"bg-indigo-500":"bg-gray-300")}>
      <span className={"absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all block shadow "+(value?"left-5":"left-0.5")}/>
    </button>
  </div>
);

const Slider = ({ label, value, min, max, step=1, onChange, fmt:fmtFn=v=>v, color="#6366f1" }) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span className="font-semibold text-gray-700">{label}</span>
      <span className="font-bold" style={{color}}>{fmtFn(value)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e=>onChange(parseFloat(e.target.value))}
      className="w-full h-1 cursor-pointer" style={{accentColor:color}}/>
    <div className="flex justify-between text-xs text-gray-400 mt-1">
      <span>{fmtFn(min)}</span><span>{fmtFn(max)}</span>
    </div>
  </div>
);

const TTip = ({ active, payload, label }) => {
  if(!active||!payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs shadow-lg">
      <p className="font-bold text-gray-900 mb-2">{label}년</p>
      {payload.map((p,i)=><p key={i} style={{color:p.color}} className="mb-1">{p.name}: {fmtF(p.value)}</p>)}
    </div>
  );
};

const parseAI = text => {
  const sections=[]; const lines=text.split("\n"); let cur=null;
  for(const line of lines){
    const h=line.match(/^##\s+(.+)/);
    if(h){if(cur)sections.push(cur);cur={title:h[1],lines:[]};}
    else if(cur)cur.lines.push(line);
    else if(line.trim()){if(!cur)cur={title:"",lines:[]};cur.lines.push(line);}
  }
  if(cur)sections.push(cur); return sections;
};

const SCOLS=["border-indigo-200 bg-indigo-50","border-emerald-200 bg-emerald-50","border-orange-200 bg-orange-50","border-violet-200 bg-violet-50","border-blue-200 bg-blue-50","border-teal-200 bg-teal-50","border-red-200 bg-red-50","border-yellow-200 bg-yellow-50"];

function runSim(inp, mine, wife, joint, debt, fixedExp, totalNet, totalExpense, CY, overrides={}) {
  const p = {...inp, ...overrides};
  const rows = [];

  let myPT   = mine.tradIRA + mine.k401;
  let wifePT = wife.tradIRA + wife.k401;
  let other  = totalNet - myPT - wifePT;

  let mortBal = debt.mortgage;
  let carBal  = debt.carLoan;
  let othBal  = debt.other;

  let expense  = totalExpense;
  let income   = p.annualIncome;
  let myMedC   = p.medicareCost;
  let wifeMedC = p.medicareCost;

  const carMonthlyPmt = calcMonthlyPmt(debt.carLoan, debt.carRate, debt.carMonths);

  for (let year = CY; year <= CY + 50; year++) {
    const yr      = year - CY;
    const myAge   = p.myAge + yr;
    const wifeAge = p.wifeAge + yr;
    const bothRetired = year >= p.myRetireYear && year >= p.wifeRetireYear;
    const isRecession = p.recessionCycle > 0 && yr > 0 && yr % p.recessionCycle === 0;

    let mortInterest = 0, mortPrincipal = 0, mortPay = 0;
    if (mortBal > 0 && year <= debt.mortgageEndYear) {
      mortInterest  = mortBal * debt.mortgageRate / 100;
      const annPmt  = debt.mortgagePayment * 12;
      mortPrincipal = Math.min(Math.max(annPmt - mortInterest, 0), mortBal);
      mortPay       = Math.min(annPmt, mortBal + mortInterest);
      mortBal       = Math.max(mortBal - mortPrincipal, 0);
      other -= mortInterest;
    }

    let carInterest = 0, carPrincipal = 0, carPay = 0;
    if (carBal > 0 && year <= debt.carEndYear) {
      carInterest  = carBal * debt.carRate / 100;
      const annPmt = carMonthlyPmt * 12;
      carPrincipal = Math.min(Math.max(annPmt - carInterest, 0), carBal);
      carPay       = Math.min(annPmt, carBal + carInterest);
      carBal       = Math.max(carBal - carPrincipal, 0);
      other -= carInterest;
    }

    let othPay = 0, othPrincipal = 0;
    if (othBal > 0 && year <= debt.otherEndYear) {
      const yLeft  = Math.max(debt.otherEndYear - year + 1, 1);
      othPrincipal = Math.min(othBal / yLeft, othBal);
      othPay       = othPrincipal;
      othBal       = Math.max(othBal - othPrincipal, 0);
    }

    const totalDebtPay     = mortPay + carPay + othPay;
    const totalInterest    = mortInterest + carInterest;
    const totalPrincipal   = mortPrincipal + carPrincipal + othPrincipal;

    myPT   *= (1 + p.assetReturn / 100);
    wifePT *= (1 + p.assetReturn / 100);
    other  *= (1 + p.assetReturn / 100);

    if (isRecession) {
      const d = 1 - p.recessionDrop / 100;
      myPT *= d; wifePT *= d; other *= d;
    }

    if (p.rothConvEnabled && year >= p.rothConvStartYear) {
      let toConv = p.annualRothConv;
      if (toConv > 0 && myPT > 0) {
        const c = Math.min(toConv, myPT);
        myPT -= c;
        other -= c * (p.rothConvTaxRate / 100);
        other += c;
        toConv -= c;
      }
      if (toConv > 0 && wifePT > 0) {
        const c = Math.min(toConv, wifePT);
        wifePT -= c;
        other -= c * (p.rothConvTaxRate / 100);
        other += c;
      }
    }

    let myRMD = 0, wifeRMD = 0, rmdTaxPaid = 0;
    if (myAge >= p.rmdStartAge && myPT > 0) {
      myRMD = myPT / getRMDDiv(myAge);
      myPT -= myRMD;
      const tax = myRMD * p.rmdTaxRate / 100;
      rmdTaxPaid += tax;
      other += myRMD - tax;
    }
    if (wifeAge >= p.rmdStartAge && wifePT > 0) {
      wifeRMD = wifePT / getRMDDiv(wifeAge);
      wifePT -= wifeRMD;
      const tax = wifeRMD * p.rmdTaxRate / 100;
      rmdTaxPaid += tax;
      other += wifeRMD - tax;
    }
    const totalRMD = myRMD + wifeRMD;

    const effIncome = bothRetired ? 0 : income;
    const wifeSS    = year >= p.wifeSS_year ? p.wifeSS_amount : 0;
    const mySSOwn   = year >= p.mySS_year   ? p.mySS_amount   : 0;
    const mySS      = p.spousalSS && wifeSS > 0 && year >= p.mySS_year
                      ? Math.max(mySSOwn, p.wifeSS_amount * 0.5) : mySSOwn;
    const totalSS   = mySS + wifeSS;

    const myMedOn   = myAge   >= p.medicareStart;
    const wifeMedOn = wifeAge >= p.medicareStart;
    const med = (myMedOn ? myMedC : 0) + (wifeMedOn ? wifeMedC : 0);

    const bothMedOn   = myMedOn && wifeMedOn;
    const eitherMedOn = myMedOn || wifeMedOn;
    const healthAdj   = bothMedOn ? 0 : eitherMedOn ? fixedExp.healthIns * 0.5 : fixedExp.healthIns;
    const adjExpense  = expense - fixedExp.healthIns + healthAdj;

    const totalExp = adjExpense + med;

    const netFlow = effIncome + totalSS - totalExp - totalInterest - rmdTaxPaid;
    other += effIncome + totalSS - totalExp;

    const tot = myPT + wifePT + other;
    const realAsset = Math.round(tot / Math.pow(1 + p.inflationRate / 100, yr));

    rows.push({
      year, myAge, wifeAge,
      asset:       Math.round(tot),
      realAsset,
      myPreTax:    Math.round(myPT),
      wifePreTax:  Math.round(wifePT),
      other:       Math.round(other),
      income:      Math.round(effIncome),
      ss:          Math.round(totalSS),
      rmd:         Math.round(totalRMD),
      rmdTax:      Math.round(rmdTaxPaid),
      medicare:    Math.round(med),
      expense:     Math.round(totalExp),
      debtPay:     Math.round(totalDebtPay),
      interest:    Math.round(totalInterest),
      principal:   Math.round(totalPrincipal),
      netFlow:     Math.round(netFlow),
      isRecession,
      myRetired:   year >= p.myRetireYear,
      wifeRetired: year >= p.wifeRetireYear,
    });

    expense *= (1 + p.expenseGrowth / 100);
    if (!bothRetired) income *= (1 + p.incomeGrowth / 100);
    if (myMedOn)   myMedC   *= (1 + p.medicareGrowth / 100);
    if (wifeMedOn) wifeMedC *= (1 + p.medicareGrowth / 100);
  }
  return rows;
}

export default function App() {
  const CY = new Date().getFullYear();

  const [joint, setJoint] = useState({cash:20000,saving:50000,brokerage:50000,annuity:0,realEstate:200000,hsa:15000});
  const [mine,  setMine]  = useState({tradIRA:80000,k401:150000,rothIRA:60000});
  const [wife,  setWife]  = useState({tradIRA:60000,k401:100000,rothIRA:40000});
  const [debt,  setDebt]  = useState({
    mortgage:150000, mortgageRate:6.5, mortgagePayment:1200, mortgageEndYear:2045,
    carLoan:15000, carRate:5.9, carPayment:0, carMonths:48, carEndYear:2028,
    other:5000, otherEndYear:2027,
  });
  const [fixedExp, setFixedExp] = useState({homeIns:2400,healthIns:6000,autoIns:1800,propTax:4000,misc:3000});
  const [inp, setInp] = useState({
    myAge:40, wifeAge:38, assetReturn:7, inflationRate:3,
    annualIncome:80000, incomeGrowth:2,
    annualExpense:48000, expenseGrowth:3,
    myRetireYear:2035, wifeRetireYear:2038, sellCostRate:10,
    mySS_year:2047, mySS_amount:24000,
    wifeSS_year:2050, wifeSS_amount:18000, spousalSS:true,
    medicareStart:65, medicareCost:4000, medicareGrowth:5,
    rmdStartAge:73, rmdTaxRate:22,
    rothConvEnabled:false, rothConvStartYear:2030, annualRothConv:25000, rothConvTaxRate:22,
    recessionCycle:10, recessionDrop:30,
  });

  const [expSec, setExpSec] = useState({asset:true,debt:true,fixed:true,basic:true,retire:true,medicare:false,rmd:false,roth:false,recession:false});
  const tog = k => setExpSec(p=>({...p,[k]:!p[k]}));
  const si = k => v => setInp(p=>({...p,[k]:v}));
  const sj = k => v => setJoint(p=>({...p,[k]:v}));
  const sm = k => v => setMine(p=>({...p,[k]:v}));
  const sw = k => v => setWife(p=>({...p,[k]:v}));
  const sd = k => v => setDebt(p=>{
    const n={...p,[k]:v};
    if(["carLoan","carRate","carMonths"].includes(k)){
      n.carPayment=calcMonthlyPmt(n.carLoan,n.carRate,n.carMonths);
      n.carEndYear=CY+Math.ceil(n.carMonths/12);
    }
    return n;
  });
  const sf = k => v => setFixedExp(p=>({...p,[k]:v}));

  const [wi, setWi] = useState({assetReturn:null,inflationRate:null,annualExpense:null,myRetireYear:null,wifeRetireYear:null});
  const setWiVal = (k,v) => setWi(p=>({...p,[k]:v}));
  const clearWi  = () => setWi({assetReturn:null,inflationRate:null,annualExpense:null,myRetireYear:null,wifeRetireYear:null});
  const hasWi = Object.values(wi).some(v=>v!==null);

  const totalJoint  = useMemo(()=>Object.values(joint).reduce((a,b)=>a+b,0),[joint]);
  const totalMine   = useMemo(()=>Object.values(mine).reduce((a,b)=>a+b,0),[mine]);
  const totalWife   = useMemo(()=>Object.values(wife).reduce((a,b)=>a+b,0),[wife]);
  const totalDebt   = useMemo(()=>debt.mortgage+debt.carLoan+debt.other,[debt]);
  const totalFixed  = useMemo(()=>Object.values(fixedExp).reduce((a,b)=>a+b,0),[fixedExp]);
  const totalGross  = useMemo(()=>totalJoint+totalMine+totalWife,[totalJoint,totalMine,totalWife]);
  const totalNet    = useMemo(()=>totalGross-totalDebt,[totalGross,totalDebt]);
  const totalExpense= useMemo(()=>inp.annualExpense+totalFixed,[inp.annualExpense,totalFixed]);
  const carPmtCalc  = useMemo(()=>calcMonthlyPmt(debt.carLoan,debt.carRate,debt.carMonths),[debt.carLoan,debt.carRate,debt.carMonths]);

  const simData = useMemo(()=>runSim(inp,mine,wife,joint,debt,fixedExp,totalNet,totalExpense,CY),
    [inp,mine,wife,joint,debt,fixedExp,totalNet,totalExpense,CY]);

  const simWi = useMemo(()=>{
    if(!hasWi) return null;
    const ov={};
    if(wi.assetReturn!==null)    ov.assetReturn    = wi.assetReturn;
    if(wi.inflationRate!==null)  ov.inflationRate  = wi.inflationRate;
    if(wi.annualExpense!==null)  ov.annualExpense  = wi.annualExpense;
    if(wi.myRetireYear!==null)   ov.myRetireYear   = wi.myRetireYear;
    if(wi.wifeRetireYear!==null) ov.wifeRetireYear = wi.wifeRetireYear;
    return runSim(inp,mine,wife,joint,debt,fixedExp,totalNet,totalExpense,CY,ov);
  },[inp,mine,wife,joint,debt,fixedExp,totalNet,totalExpense,CY,wi,hasWi]);

  const chartData = useMemo(()=>simData.map((r,i)=>({
    ...r, assetWI: simWi?simWi[i]?.asset:undefined,
  })),[simData,simWi]);

  const ruinYear   = simData.find(r=>r.asset<=0);
  const ruinYearWI = simWi?.find(r=>r.asset<=0);
  const retireRow  = simData.find(r=>r.year===inp.myRetireYear);
  const rmdRow     = simData.find(r=>r.myAge>=inp.rmdStartAge);
  const tableRows  = simData.filter((_,i)=>i%2===0).slice(0,26);
  const sc = v => v<0?"text-red-500":v<totalNet*.3?"text-amber-500":"text-emerald-600";

  const [consulting,setConsulting] = useState(null);
  const [loading,setLoading]       = useState(false);
  const [chartView,setChartView]   = useState("nominal");
  const [mobileTab,setMobileTab]   = useState("input");
  const [isMob,setIsMob]           = useState(false);
  const consultRef = useRef(null);

  useEffect(()=>{
    const check=()=>setIsMob(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  const runConsulting = async () => {
    setLoading(true); setConsulting(null);
    setTimeout(()=>consultRef.current?.scrollIntoView({behavior:"smooth"}),300);
    const preTaxRatio=((mine.tradIRA+mine.k401+wife.tradIRA+wife.k401)/totalNet*100).toFixed(0);
    const withdrawalRate=retireRow?(totalExpense/retireRow.asset*100).toFixed(1):"N/A";
    const prompt="You are a seasoned retirement financial advisor with 30 years of experience. Analyze the following client data and provide a comprehensive retirement consulting report IN KOREAN.\n\n"
      +"CLIENT: My Age "+inp.myAge+", Wife "+inp.wifeAge+", Retire "+inp.myRetireYear+"/"+inp.wifeRetireYear+"\n"
      +"ASSETS: Gross "+fmtF(totalGross)+", Net "+fmtF(totalNet)+", Pre-tax ratio "+preTaxRatio+"%\n"
      +"Mine: TradIRA $"+mine.tradIRA+", 401K $"+mine.k401+", Roth $"+mine.rothIRA+"\n"
      +"Wife: TradIRA $"+wife.tradIRA+", 401K $"+wife.k401+", Roth $"+wife.rothIRA+"\n"
      +"Joint: Cash $"+joint.cash+", Savings $"+joint.saving+", Brokerage $"+joint.brokerage+", RE $"+joint.realEstate+", HSA $"+joint.hsa+"\n"
      +"DEBTS: Mortgage $"+debt.mortgage+" @"+debt.mortgageRate+"%, Car $"+debt.carLoan+" @"+debt.carRate+"%, Other $"+debt.other+"\n"
      +"EXPENSES: Total "+fmtF(totalExpense)+"/yr, Living $"+inp.annualExpense+", HealthIns $"+fixedExp.healthIns+", PropTax $"+fixedExp.propTax+"\n"
      +"INCOME: $"+inp.annualIncome+"/yr +"+inp.incomeGrowth+"%/yr, Asset return "+inp.assetReturn+"%\n"
      +"SS: Mine "+inp.mySS_year+" $"+inp.mySS_amount+"/yr, Wife "+inp.wifeSS_year+" $"+inp.wifeSS_amount+"/yr, Spousal:"+inp.spousalSS+"\n"
      +"MEDICARE: Age "+inp.medicareStart+", $"+(inp.medicareCost*2)+"/yr couple, +"+inp.medicareGrowth+"%/yr\n"
      +"RMD: Start age "+inp.rmdStartAge+", tax "+inp.rmdTaxRate+"%, balance: "+(rmdRow?fmtF(rmdRow.myPreTax+rmdRow.wifePreTax):"N/A")+"\n"
      +"ROTH: "+(inp.rothConvEnabled?"Enabled $"+inp.annualRothConv+"/yr from "+inp.rothConvStartYear+" @"+inp.rothConvTaxRate+"%":"Disabled")+"\n"
      +"RESULT: Asset at retirement "+(retireRow?fmtF(retireRow.asset):"N/A")+", Withdrawal rate "+withdrawalRate+"%\n"
      +"Depletion: "+(ruinYear?ruinYear.year+"년 age "+ruinYear.myAge:"None in 50 years")+"\n\n"
      +"Sections (## headers): ## 📊 재무 건전성 진단 / ## 💸 인출 전략 / ## 🏦 RMD 영향 및 대응 / ## 🔄 Roth Conversion 전략 / ## 🏥 Medicare/IRMAA 전략 / ## 📅 Social Security 최적화 / ## ⚡ 불황 대응 / ## ✅ 핵심 실행 체크리스트";
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      if(data.error)setConsulting("## ⚠️ 오류\n"+data.error.message);
      else if(data.content?.length>0)setConsulting(data.content.filter(c=>c.type==="text").map(c=>c.text).join("\n"));
      else setConsulting("## ⚠️ 응답 없음\n잠시 후 다시 시도해주세요.");
    } catch(e){setConsulting("## ⚠️ 네트워크 오류\n"+e.message);}
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={{fontFamily:"'Segoe UI',sans-serif"}}>
      {isMob&&(
        <div className="flex sticky top-0 z-50 bg-white border-b-2 border-gray-200 shadow-sm">
          {[["input","⚙️ 입력"],["result","📊 결과"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>setMobileTab(tab)}
              className="flex-1 py-3 border-none text-sm font-semibold cursor-pointer transition-colors"
              style={{background:"transparent",color:mobileTab===tab?"#6366f1":"#9ca3af",
                borderBottom:mobileTab===tab?"3px solid #6366f1":"3px solid transparent"}}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex" style={{flexDirection:isMob?"column":"row",height:isMob?"auto":"100vh"}}>
        {/* LEFT */}
        <div className="bg-white border-r border-gray-200 p-4 overflow-y-auto"
          style={{width:isMob?"100%":272,flexShrink:0,display:isMob&&mobileTab!=="input"?"none":"block"}}>
          <h1 className="text-base font-bold text-indigo-500 mb-1">💰 자산 시뮬레이터</h1>
          <p className="text-xs text-gray-400 mb-3">재무 정보를 입력하고 미래를 시뮬레이션하세요</p>

          <Sec title="📦 자산 구성" expanded={expSec.asset} onToggle={()=>tog("asset")} badge={fmtF(totalGross)}>
            <SL color="text-emerald-600">🏠 공동 자산</SL>
            {[["cash","Cash"],["saving","Savings"],["brokerage","Brokerage"],["annuity","Annuity"],["realEstate","부동산"],["hsa","HSA"]].map(([k,l])=>(
              <F key={k} label={l} value={joint[k]} onChange={sj(k)} prefix="$" step={1000} min={0}/>
            ))}
            <Divider label="공동 소계" value={fmtF(totalJoint)}/>
            <SL color="text-indigo-500">👤 내 계좌</SL>
            {[["tradIRA","Traditional IRA"],["k401","401(K)"],["rothIRA","Roth IRA"]].map(([k,l])=>(
              <F key={k} label={l} value={mine[k]} onChange={sm(k)} prefix="$" step={1000} min={0}/>
            ))}
            <Divider label="내 계좌 소계" value={fmtF(totalMine)} color="text-indigo-500"/>
            <SL color="text-purple-500">👩 아내 계좌</SL>
            {[["tradIRA","Traditional IRA"],["k401","401(K)"],["rothIRA","Roth IRA"]].map(([k,l])=>(
              <F key={k} label={l} value={wife[k]} onChange={sw(k)} prefix="$" step={1000} min={0}/>
            ))}
            <Divider label="아내 계좌 소계" value={fmtF(totalWife)} color="text-purple-500"/>
          </Sec>

          <Sec title="🏦 부채" expanded={expSec.debt} onToggle={()=>tog("debt")} badge={"-"+fmtF(totalDebt)}>
            <p className="text-xs text-gray-400 mb-2">이자만 비용 처리 · 원금 상환은 순자산 변화 없음</p>
            <SL color="text-red-500">🏠 모기지</SL>
            <F label="잔액" value={debt.mortgage} onChange={sd("mortgage")} prefix="$" step={5000} min={0}/>
            <F label="금리" value={debt.mortgageRate} onChange={sd("mortgageRate")} unit="%" step={0.1} min={0} max={15}/>
            <F label="월 페이먼트" value={debt.mortgagePayment} onChange={sd("mortgagePayment")} prefix="$" step={100} min={0}/>
            <F label="완납 예정 연도" value={debt.mortgageEndYear} onChange={sd("mortgageEndYear")} unit="년" min={CY} max={2070}/>
            <SL color="text-red-500">🚗 자동차 할부</SL>
            <F label="잔액 (원금)" value={debt.carLoan} onChange={sd("carLoan")} prefix="$" step={1000} min={0}/>
            <F label="금리" value={debt.carRate} onChange={sd("carRate")} unit="%" step={0.1} min={0} max={20}/>
            <F label="상환 기간" value={debt.carMonths} onChange={sd("carMonths")} unit="개월" step={6} min={6} max={84}/>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2 text-xs">
              <div className="flex justify-between mb-1"><span className="text-gray-500">월 페이먼트</span><span className="text-indigo-600 font-bold">${carPmtCalc.toFixed(0)}/월</span></div>
              <div className="flex justify-between"><span className="text-gray-500">총 상환액</span><span className="text-indigo-600 font-bold">${(carPmtCalc*debt.carMonths).toFixed(0)}</span></div>
            </div>
            <F label="완납 예정 연도" value={debt.carEndYear} readOnly unit="년"/>
            <SL color="text-red-500">💳 기타 부채</SL>
            <F label="잔액" value={debt.other} onChange={sd("other")} prefix="$" step={1000} min={0}/>
            <F label="완납 예정 연도" value={debt.otherEndYear} onChange={sd("otherEndYear")} unit="년" min={CY} max={2070}/>
            <Divider label="부채 합계" value={"-"+fmtF(totalDebt)} color="text-red-500"/>
            <Divider label="순자산" value={fmtF(totalNet)} color="text-emerald-600"/>
          </Sec>

          <Sec title="🧾 고정 지출" expanded={expSec.fixed} onToggle={()=>tog("fixed")} badge={fmtF(totalFixed)+"/yr"}>
            <p className="text-xs text-gray-400 mb-2">생활비와 합산 → 총 지출. Medicare 시작 시 건강보험 자동 삭감.</p>
            <F label="집 보험" value={fixedExp.homeIns} onChange={sf("homeIns")} prefix="$" step={100} min={0}/>
            <F label="건강 보험" value={fixedExp.healthIns} onChange={sf("healthIns")} prefix="$" step={100} min={0}/>
            <F label="자동차 보험" value={fixedExp.autoIns} onChange={sf("autoIns")} prefix="$" step={100} min={0}/>
            <F label="Property Tax" value={fixedExp.propTax} onChange={sf("propTax")} prefix="$" step={100} min={0}/>
            <F label="기타 부대비용" value={fixedExp.misc} onChange={sf("misc")} prefix="$" step={500} min={0} hint="(집수선·자녀)"/>
            <Divider label="고정지출 소계" value={fmtF(totalFixed)+"/yr"}/>
            <Divider label="총 연 지출" value={fmtF(totalExpense)+"/yr"} color="text-amber-500"/>
          </Sec>

          <Sec title="👤 기본 & 수익" expanded={expSec.basic} onToggle={()=>tog("basic")}>
            <F label="내 나이" value={inp.myAge} onChange={si("myAge")} unit="세" min={20} max={80}/>
            <F label="아내 나이" value={inp.wifeAge} onChange={si("wifeAge")} unit="세" min={20} max={80}/>
            <F label="자산 연 수익률" value={inp.assetReturn} onChange={si("assetReturn")} unit="%" step={0.1}/>
            <F label="인플레이션율" value={inp.inflationRate} onChange={si("inflationRate")} unit="%" step={0.1} hint="(실질 차트용)"/>
            <F label="연 수입" value={inp.annualIncome} onChange={si("annualIncome")} prefix="$" step={1000}/>
            <F label="연 수입 증가율" value={inp.incomeGrowth} onChange={si("incomeGrowth")} unit="%" step={0.1}/>
            <F label="연 생활비" value={inp.annualExpense} onChange={si("annualExpense")} prefix="$" step={1000} hint="(고정지출 별도)"/>
            <F label="연 지출 증가율" value={inp.expenseGrowth} onChange={si("expenseGrowth")} unit="%" step={0.1} hint="(인플레이션)"/>
          </Sec>

          <Sec title="🏖️ 은퇴 & Social Security" expanded={expSec.retire} onToggle={()=>tog("retire")}>
            <F label="내 은퇴 연도" value={inp.myRetireYear} onChange={si("myRetireYear")} unit="년" min={CY} max={2070}/>
            <F label="아내 은퇴 연도" value={inp.wifeRetireYear} onChange={si("wifeRetireYear")} unit="년" min={CY} max={2070}/>
            <F label="자산 매각 비용율" value={inp.sellCostRate} onChange={si("sellCostRate")} unit="%" step={0.1} hint="(세금+수수료)"/>
            <SL color="text-indigo-500">👤 내 Social Security</SL>
            <F label="수령 시작 연도" value={inp.mySS_year} onChange={si("mySS_year")} unit="년" min={CY} max={2070}/>
            <F label="연 수령액 (본인)" value={inp.mySS_amount} onChange={si("mySS_amount")} prefix="$" step={500} min={0}/>
            <Toggle label="Spousal Benefit 적용" value={inp.spousalSS} onChange={v=>si("spousalSS")(v)}/>
            {inp.spousalSS&&(
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-xs text-indigo-600 mb-2 leading-relaxed">
                <p>• 아내 SS의 50% = {fmtF(inp.wifeSS_amount*.5)}/yr</p>
                <p>• 내 SS ({fmtF(inp.mySS_amount)}) 보다 {inp.wifeSS_amount*.5>inp.mySS_amount?"높으므로 자동 적용":"낮으므로 본인 금액 적용"}</p>
              </div>
            )}
            <SL color="text-purple-500">👩 아내 Social Security</SL>
            <F label="수령 시작 연도" value={inp.wifeSS_year} onChange={si("wifeSS_year")} unit="년" min={CY} max={2070}/>
            <F label="연 수령액" value={inp.wifeSS_amount} onChange={si("wifeSS_amount")} prefix="$" step={500} min={0}/>
          </Sec>

          <Sec title="🏥 Medicare" expanded={expSec.medicare} onToggle={()=>tog("medicare")}>
            <p className="text-xs text-gray-400 mb-2">1인 기준 · Medicare 시작 시 건강보험 자동 삭감</p>
            <F label="시작 나이" value={inp.medicareStart} onChange={si("medicareStart")} unit="세" min={60} max={70} hint="(일반 65세)"/>
            <F label="연 비용 (1인)" value={inp.medicareCost} onChange={si("medicareCost")} prefix="$" step={500} min={0}/>
            <F label="비용 증가율" value={inp.medicareGrowth} onChange={si("medicareGrowth")} unit="%" step={0.5}/>
          </Sec>

          <Sec title="🏦 RMD 설정" expanded={expSec.rmd} onToggle={()=>tog("rmd")}>
            <p className="text-xs text-gray-400 mb-2">세후 금액은 재투자 가정 (brokerage 등으로 이동)</p>
            <F label="RMD 시작 나이" value={inp.rmdStartAge} onChange={si("rmdStartAge")} unit="세" min={72} max={75} hint="(현행 73세)"/>
            <F label="RMD 적용 세율" value={inp.rmdTaxRate} onChange={si("rmdTaxRate")} unit="%" step={1} min={0} max={50}/>
          </Sec>

          <Sec title="🔄 Roth Conversion" expanded={expSec.roth} onToggle={()=>tog("roth")} badge={inp.rothConvEnabled?"ON":"OFF"}>
            <Toggle label="활성화" value={inp.rothConvEnabled} onChange={v=>si("rothConvEnabled")(v)}/>
            {inp.rothConvEnabled&&<>
              <F label="시작 연도" value={inp.rothConvStartYear} onChange={si("rothConvStartYear")} unit="년" min={CY} max={2070}/>
              <F label="연 전환 금액" value={inp.annualRothConv} onChange={si("annualRothConv")} prefix="$" step={1000} min={0}/>
              <F label="전환 시 세율" value={inp.rothConvTaxRate} onChange={si("rothConvTaxRate")} unit="%" step={1} min={0} max={50}/>
            </>}
          </Sec>

          <Sec title="⚡ 불황 설정" expanded={expSec.recession} onToggle={()=>tog("recession")}>
            <F label="불황 주기" value={inp.recessionCycle} onChange={si("recessionCycle")} unit="년마다" min={1} max={30}/>
            <F label="불황 시 자산 하락율" value={inp.recessionDrop} onChange={si("recessionDrop")} unit="%" step={1} min={0} max={80}/>
          </Sec>

          <button onClick={runConsulting} disabled={loading}
            className="w-full mt-3 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{background:"linear-gradient(135deg,#6366f1,#a855f7)",border:"none",cursor:"pointer",boxShadow:"0 4px 12px rgba(99,102,241,.25)"}}>
            {loading?"🤔 분석 중...":"🎯 AI 은퇴 컨설팅 받기"}
          </button>
          {isMob&&(
            <button onClick={()=>setMobileTab("result")}
              className="w-full mt-2 py-3 rounded-xl font-bold text-sm text-white"
              style={{background:"linear-gradient(135deg,#059669,#10b981)",border:"none",cursor:"pointer"}}>
              📊 결과 보기 →
            </button>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex-1 p-4 overflow-y-auto bg-gray-50"
          style={{display:isMob&&mobileTab!=="result"?"none":"block"}}>

          <div className="grid gap-3 mb-4" style={{gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))"}}>
            {[
              {l:"현재 연도",v:CY+"년",s:"나 "+inp.myAge+"세 / 아내 "+inp.wifeAge+"세",c:"text-indigo-500"},
              {l:"내 은퇴",v:inp.myRetireYear+"년",s:"만 "+(inp.myAge+inp.myRetireYear-CY)+"세",c:"text-purple-500"},
              {l:"아내 은퇴",v:inp.wifeRetireYear+"년",s:"만 "+(inp.wifeAge+inp.wifeRetireYear-CY)+"세",c:"text-pink-500"},
              {l:"현재 순자산",v:fmtF(totalNet),s:"총 "+fmtF(totalGross)+" - 부채 "+fmtF(totalDebt),c:"text-emerald-600"},
              {l:"자산 소진",v:ruinYear?ruinYear.year+"년":"소진 없음",s:ruinYear?"만 "+ruinYear.myAge+"세":"50년+ 유지",c:ruinYear?"text-red-500":"text-emerald-600"},
            ].map((c,i)=>(
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{c.l}</p>
                <p className={"text-sm font-bold leading-tight "+c.c}>{c.v}</p>
                <p className="text-xs text-gray-400 mt-1">{c.s}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-2">🏦 현재 자산 구성</h2>
            <div className="flex rounded-lg overflow-hidden h-4 mb-2">
              {[{l:"공동",v:totalJoint,c:"#10b981"},{l:"내 Pre-tax",v:mine.tradIRA+mine.k401,c:"#6366f1"},{l:"내 Roth",v:mine.rothIRA,c:"#60a5fa"},{l:"아내 Pre-tax",v:wife.tradIRA+wife.k401,c:"#a855f7"},{l:"아내 Roth",v:wife.rothIRA,c:"#f472b6"}].filter(x=>x.v>0).map((x,i)=>(
                <div key={i} style={{width:(x.v/totalGross*100)+"%",background:x.c}} title={x.l+": "+fmtF(x.v)}/>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[{l:"공동",v:totalJoint,c:"text-emerald-600"},{l:"내 Pre-tax",v:mine.tradIRA+mine.k401,c:"text-indigo-500"},{l:"내 Roth",v:mine.rothIRA,c:"text-blue-500"},{l:"아내 Pre-tax",v:wife.tradIRA+wife.k401,c:"text-purple-500"},{l:"아내 Roth",v:wife.rothIRA,c:"text-pink-500"},{l:"부채",v:-totalDebt,c:"text-red-500"}].map((x,i)=>(
                <span key={i} className={"text-xs "+x.c}>● {x.l}: {fmtF(x.v)}</span>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4 mb-4 border border-yellow-200 bg-yellow-50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-yellow-800">🎛️ What-if 시뮬레이션</h2>
              {hasWi&&<button onClick={clearWi} className="text-xs text-gray-500 bg-white border border-gray-200 rounded-md px-2 py-1 cursor-pointer">초기화</button>}
            </div>
            <div className="grid gap-x-6" style={{gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))"}}>
              <Slider label="투자 수익률" value={wi.assetReturn??inp.assetReturn} min={0} max={20} step={0.5} onChange={v=>setWiVal("assetReturn",v)} fmt={v=>v+"%"} color="#6366f1"/>
              <Slider label="인플레이션" value={wi.inflationRate??inp.inflationRate} min={0} max={10} step={0.5} onChange={v=>setWiVal("inflationRate",v)} fmt={v=>v+"%"} color="#f59e0b"/>
              <Slider label="연 소비" value={wi.annualExpense??inp.annualExpense} min={10000} max={200000} step={1000} onChange={v=>setWiVal("annualExpense",v)} fmt={v=>"$"+(v/1000).toFixed(0)+"K"} color="#ef4444"/>
              <Slider label="내 은퇴 연도" value={wi.myRetireYear??inp.myRetireYear} min={CY} max={CY+30} step={1} onChange={v=>setWiVal("myRetireYear",v)} fmt={v=>v+"년"} color="#059669"/>
              <Slider label="아내 은퇴 연도" value={wi.wifeRetireYear??inp.wifeRetireYear} min={CY} max={CY+30} step={1} onChange={v=>setWiVal("wifeRetireYear",v)} fmt={v=>v+"년"} color="#a855f7"/>
            </div>
            {hasWi&&(
              <div className="flex gap-4 mt-2 p-2 bg-white rounded-lg text-xs border border-gray-100">
                <span>기준: <strong className="text-indigo-500">{ruinYear?ruinYear.year+"년 소진":"50년+ 유지"}</strong></span>
                <span>→ What-if: <strong className={ruinYearWI?"text-red-500":"text-emerald-600"}>{ruinYearWI?ruinYearWI.year+"년 소진":"50년+ 유지"}</strong></span>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700">📊 자산 변화 추이 (50년) — {chartView==="nominal"?"명목값":"실질값"}</h2>
              <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                {["nominal","real"].map(v=>(
                  <button key={v} onClick={()=>setChartView(v)}
                    className="px-3 py-1 rounded-md border-none cursor-pointer transition-all"
                    style={{background:chartView===v?"#fff":"transparent",color:chartView===v?"#111827":"#9ca3af",fontWeight:chartView===v?700:400,boxShadow:chartView===v?"0 1px 2px rgba(0,0,0,.08)":"none"}}>
                    {v==="nominal"?"Nominal":"Real"}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{top:5,right:20,left:10,bottom:5}}>
                <defs>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="year" tick={{fontSize:10,fill:"#9ca3af"}} interval={4}/>
                <YAxis tickFormatter={fmt} tick={{fontSize:10,fill:"#9ca3af"}} width={65}/>
                <Tooltip content={<TTip/>}/>
                <Legend wrapperStyle={{fontSize:11,color:"#374151"}}/>
                <ReferenceLine x={inp.myRetireYear} stroke="#6366f1" strokeDasharray="4 4" label={{value:"내 은퇴",fill:"#6366f1",fontSize:10}}/>
                <ReferenceLine x={inp.wifeRetireYear} stroke="#a855f7" strokeDasharray="4 4" label={{value:"아내 은퇴",fill:"#a855f7",fontSize:10}}/>
                <ReferenceLine x={inp.mySS_year} stroke="#059669" strokeDasharray="2 4" label={{value:"내 SS",fill:"#059669",fontSize:9}}/>
                <ReferenceLine x={inp.wifeSS_year} stroke="#10b981" strokeDasharray="2 4" label={{value:"아내 SS",fill:"#10b981",fontSize:9}}/>
                <ReferenceLine x={CY+(inp.rmdStartAge-inp.myAge)} stroke="#f59e0b" strokeDasharray="2 4" label={{value:"RMD",fill:"#f59e0b",fontSize:9}}/>
                {inp.rothConvEnabled&&<ReferenceLine x={inp.rothConvStartYear} stroke="#10b981" strokeDasharray="1 3" label={{value:"Roth",fill:"#10b981",fontSize:9}}/>}
                <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.5}/>
                <Area type="monotone" dataKey={chartView==="nominal"?"asset":"realAsset"} name="총 자산" stroke="#6366f1" fill="url(#ga)" strokeWidth={2.5} dot={false}/>
                {hasWi&&<Area type="monotone" dataKey="assetWI" name="What-if 자산" stroke="#f59e0b" fill="url(#gw)" strokeWidth={2} dot={false} strokeDasharray="5 3"/>}
                <Line type="monotone" dataKey="ss" name="Social Security" stroke="#059669" strokeWidth={1.5} dot={false} strokeDasharray="3 3"/>
                <Line type="monotone" dataKey="rmd" name="연 RMD" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="3 3"/>
                <Line type="monotone" dataKey="medicare" name="Medicare" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="3 3"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-1">📋 연도별 상세 현황</h2>
            <p className="text-xs text-gray-400 mb-3">순증감 = 수입 + SS - 생활비 - 이자비용 - RMD세금 · 부채원금상환은 순자산 변화 없음</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{minWidth:900}}>
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    {["연도","내 나이","아내","총 자산","내 Pre-tax","아내 Pre-tax","RMD","RMD세금","수입","SS","Medicare","이자비용","총 생활지출","순증감","상태"].map(h=>(
                      <th key={h} className="text-left text-gray-400 py-2 px-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r,i)=>(
                    <tr key={r.year} className={"border-b border-gray-100 "+(r.isRecession?"bg-red-50":i%2?"bg-gray-50":"bg-white")}>
                      <td className="py-2 px-2 font-bold text-gray-800">{r.year}</td>
                      <td className="py-2 px-2 text-gray-500">{r.myAge}세</td>
                      <td className="py-2 px-2 text-gray-500">{r.wifeAge}세</td>
                      <td className={"py-2 px-2 font-bold "+sc(r.asset)}>{fmtF(r.asset)}</td>
                      <td className="py-2 px-2 text-indigo-500">{fmtF(r.myPreTax)}</td>
                      <td className="py-2 px-2 text-purple-500">{fmtF(r.wifePreTax)}</td>
                      <td className="py-2 px-2 text-amber-500">{r.rmd>0?fmtF(r.rmd):"-"}</td>
                      <td className="py-2 px-2 text-red-400">{r.rmdTax>0?"-"+fmtF(r.rmdTax):"-"}</td>
                      <td className="py-2 px-2 text-emerald-600">{r.income>0?fmtF(r.income):"-"}</td>
                      <td className="py-2 px-2 text-teal-600">{r.ss>0?fmtF(r.ss):"-"}</td>
                      <td className="py-2 px-2 text-red-400">{r.medicare>0?fmtF(r.medicare):"-"}</td>
                      <td className="py-2 px-2 text-red-400">{r.interest>0?"-"+fmtF(r.interest):"-"}</td>
                      <td className="py-2 px-2 text-amber-500">{fmtF(r.expense)}</td>
                      <td className={"py-2 px-2 font-bold "+(r.netFlow>=0?"text-emerald-600":"text-red-500")}>{r.netFlow>=0?"+":""}{fmtF(r.netFlow)}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {r.isRecession&&<span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-xs mr-1 font-semibold">불황⚡</span>}
                        {r.myRetired&&r.wifeRetired&&<span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded text-xs font-semibold">둘다은퇴</span>}
                        {r.myRetired&&!r.wifeRetired&&<span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded text-xs font-semibold">내은퇴</span>}
                        {!r.myRetired&&r.wifeRetired&&<span className="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-semibold">아내은퇴</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div ref={consultRef}>
            {loading&&(
              <div className="bg-white border border-indigo-100 rounded-xl p-10 text-center shadow-sm">
                <div className="text-4xl mb-3">🧠</div>
                <p className="text-indigo-500 font-semibold mb-1">30년 경력 은퇴 설계사가 분석 중입니다...</p>
                <p className="text-gray-400 text-xs">입력하신 모든 데이터를 종합적으로 검토하고 있습니다</p>
                <div className="flex justify-center gap-1 mt-4">
                  {[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:i*.2+"s"}}/>)}
                </div>
              </div>
            )}
            {consulting&&!loading&&(
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h2 className="text-base font-bold text-gray-800">AI 은퇴 컨설팅 리포트</h2>
                    <p className="text-xs text-gray-400">30년 경력 은퇴 설계사 분석 · 입력 데이터 기반 맞춤 제안</p>
                  </div>
                  <button onClick={runConsulting} className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 cursor-pointer">🔄 재분석</button>
                </div>
                <div className="flex flex-col gap-3">
                  {parseAI(consulting).map((sec,i)=>(
                    <div key={i} className={"border rounded-xl p-4 "+SCOLS[i%SCOLS.length]}>
                      {sec.title&&<h3 className="text-sm font-bold text-gray-800 mb-2">{sec.title}</h3>}
                      <div className="text-xs text-gray-700 leading-relaxed space-y-1">
                        {sec.lines.filter(l=>l.trim()).map((line,j)=>{
                          if(line.startsWith("- ")||line.startsWith("• ")) return <p key={j} className="flex gap-2"><span className="text-gray-400">•</span><span>{line.replace(/^[-•]\s*/,"")}</span></p>;
                          if(line.startsWith("**")&&line.endsWith("**")) return <p key={j} className="font-bold text-gray-800 mt-2">{line.replace(/\*\*/g,"")}</p>;
                          return <p key={j}>{line}</p>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center mt-4">⚠️ 본 컨설팅은 AI 기반 참고 자료입니다. 실제 투자 및 세무 결정은 전문 재무 설계사와 상담하시기 바랍니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
