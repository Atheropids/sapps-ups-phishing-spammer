'use strict';

/*
 * Copyright (c) 2022, Atheropids.
 * All rights reserved.
 */

module.exports = class Random
{
  constructor()
  {
    this.state = new Uint8Array(6);
    this.index = 0;
  }

  rotate()
  {
    let cache = Math.floor(Math.random() * 0x1000000000000);

    let i;
    for(i = 0 ; i < this.state.length ; i++)
    {
      this.state[i] = cache % 256;
      cache = Math.floor(cache * 3.90625E-3);
    }
  }

  nextU8()
  {
    if(this.index == 0)
    {
      this.rotate();
    }

    let ret = this.state[this.index];
    this.index++;

    if(this.index >= this.state.length)
    {
      this.index = 0;
    }

    return ret;
  }

  nextU16()
  {
    let ret = new Uint16Array(1);
    ret[0] = 0;

    for(let i = 0 ; i < 16 ; i += 8)
    {
      ret[0] |= (this.nextU8() << i);
    }

    return ret[0];
  }

  nextU32()
  {
    let ret = new Uint32Array(1);
    ret[0] = 0;

    for(let i = 0 ; i < 32 ; i += 8)
    {
      ret[0] |= (this.nextU8() << i);
    }

    return ret[0];
  }

  nextBytes(len)
  {
    if(len <= 0)
    {
      return new Uint8Array(0);
    }

    let ret = new Uint8Array(len);
    for(let i = 0 ; i < len ; i++)
    {
      ret[i] = this.nextU8();
    }

    return ret;
  }

  nextFloat()
  {
    return (this.nextU32() / maxU32);
  }

  nextGaussian()
  {
    const PI2 = Math.PI * 2;
    let ret;
    if(isNaN(this.gaussCache))
    {
      let cache = [0, this.nextFloat()];
      do
      {
        cache[0] = this.nextFloat();
      }
      while(cache[0] < 1E-6);
  
      cache[0] = Math.log(cache[0]);
  
      ret = cache[0] * Math.cos(PI2 * cache[1]);
      this.gaussCache = cache[0] * Math.sin(PI2 * cache[1]);
    }
    else
    {
      ret = this.gaussCache;
      this.gaussCache = NaN;
    }
    return ret;
  }

  nextBool()
  {
    if(this.boolCacheIdx == 0)
    {
      this.boolCache = this.nextU8();
    }
    let ret = ((this.boolCache & (0x1 << this.boolCacheIdx)) > 0);
    this.boolCacheIdx++;
    if(this.boolCacheIdx >= 8)
    {
      this.boolCacheIdx = 0;
    }
    return ret;
  }
};
