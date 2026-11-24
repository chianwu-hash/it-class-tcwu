import assert from 'node:assert/strict';

// Caller binds visually checked original/teacher rows to their immutable assets.
// This verifies the arithmetic; it does not read pixels or grade handwriting.
export function verifyDivisionCorrection({dividend,divisor,shown,teacher}){
 const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 assert.ok(integer(dividend,10,99)&&integer(divisor,1,9));
 for(const row of [shown,teacher]){assert.ok(row&&integer(row.quotient,0,99)&&integer(row.product,0,999)&&integer(row.remainder,0,99));assert.deepEqual(Object.keys(row).sort(),['product','quotient','remainder']);}
 const corrected={quotient:Math.floor(dividend/divisor),product:Math.floor(dividend/divisor)*divisor,remainder:dividend%divisor};assert.deepEqual(teacher,corrected,'Teacher diagram must match independent division');
 const errors=[];if(shown.product!==shown.quotient*divisor)errors.push('wrong_product');if(shown.product>dividend)errors.push('product_exceeds_dividend');if(shown.product+shown.remainder!==dividend)errors.push('wrong_subtraction');if(shown.remainder>=divisor)errors.push('remainder_not_less_than_divisor');
 assert.ok(errors.length,'A correct original cannot enter the correction-only cohort');return {dividend,divisor,shown:{...shown},corrected,errors};
}
