// Synthetic local identities. No real account, token or remote request.
const grade=Number(location.pathname.match(/grade([3469])/)[1]);
window.fixtureUsers={a:{id:'a',email:'a@example.invalid'},b:{id:'b',email:'b@example.invalid'},teacher:{id:'teacher',email:'teacher@example.invalid'}};
window.fixtureSession={user:fixtureUsers.a,access_token:'synthetic-only'};
window.fixtureRows={a:{class_code:grade+'01',seat_no:7,display_name:'小禾',email:'a@example.invalid'},b:{class_code:grade+'02',seat_no:12,display_name:'小晴',email:'b@example.invalid'}};
window.fixtureCalls=[];window.fixtureDelay=false;window.fixtureRelease=null;window.fixtureLogin=0;window.fixtureLogout=0;window.fixtureFail=false;
const callbacks=[];
export const resolveSession=async()=>window.fixtureSession;
export const isTeacher=s=>s?.user.id==='teacher';
export const beginCentralizedLogin=()=>window.fixtureLogin++;
export const signOutAndReload=async()=>{window.fixtureLogout++;window.fixtureSwitch(null);};
export const supabase={auth:{onAuthStateChange(fn){callbacks.push(fn);}},realtime:{async setAuth(){}},async rpc(name,args){
 if(name!=='get_my_student_enrollment'||args.p_school_year!==115)throw Error('unexpected_roster_read');
 const id=window.fixtureSession?.user.id,row=window.fixtureRows[id];window.fixtureCalls.push(id);
 if(window.fixtureDelay){window.fixtureDelay=false;await new Promise(r=>window.fixtureRelease=r);}
 return window.fixtureFail?{data:null,error:{message:'synthetic unavailable'}}:{data:row?[row]:[],error:null};
}};
window.fixtureSwitch=id=>{window.fixtureSession=id?{user:fixtureUsers[id],access_token:'synthetic-only'}:null;for(const fn of callbacks)fn('SIGNED_IN',fixtureSession);};
window.fixtureRefresh=()=>{for(const fn of callbacks)fn('TOKEN_REFRESHED',fixtureSession);};
