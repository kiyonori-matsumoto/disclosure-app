import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

/*
  Generated class for the DocumentBoxProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class DocumentBoxProvider {

  constructor(public http: HttpClient) {
    console.log('Hello DocumentBoxProvider Provider');
  }

}
