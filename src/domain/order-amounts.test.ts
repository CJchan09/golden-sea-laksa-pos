import { describe, it, expect } from 'vitest';
import { calculateOrderAmounts } from './order-amounts';
import { createDemoBaselineSettings } from '../demo-baseline';
import type { CartItem } from '../types';
const cart = [{totalPrice:8,quantity:1} as CartItem];
describe('confirmed order amounts',()=>{
  it('does not charge packing or tax for an empty cart',()=>{
    const settings={...createDemoBaselineSettings(),enableTax:true,taxRate:6,takeawayFee:0.5};
    expect(calculateOrderAmounts([],settings,'Takeaway')).toEqual({subtotal:0,takeawayFee:0,taxAmount:0,totalAmount:0});
  });
  it('adds packing before tax and uses rounded sen consistently',()=>{
    const settings={...createDemoBaselineSettings(),enableTax:true,taxRate:6,takeawayFee:0.5};
    expect(calculateOrderAmounts(cart,settings,'Takeaway')).toEqual({subtotal:8,takeawayFee:0.5,taxAmount:0.51,totalAmount:9.01});
    expect(calculateOrderAmounts(cart,settings,'Dine-in').totalAmount).toBe(8.48);
  });
  it('avoids floating point excess across multiple lines',()=>{
    const settings=createDemoBaselineSettings();
    expect(calculateOrderAmounts([{totalPrice:0.1} as CartItem,{totalPrice:0.2} as CartItem],settings,'Dine-in').totalAmount).toBe(0.3);
  });
});
