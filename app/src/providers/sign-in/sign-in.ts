import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { AngularFireAuth } from "angularfire2/auth";

/*
  Generated class for the SignInProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class SignInProvider {

  constructor(afAuth: AngularFireAuth) {
    console.log('Hello SignInProvider Provider');
  }

}
