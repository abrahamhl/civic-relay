'use client';
import {useEffect} from 'react';
import type {Locale} from './copy';
export default function LanguageDocument({locale}:{locale:Locale}){
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 return null;
}
