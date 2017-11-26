import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { AngularFirestore } from 'angularfire2/firestore';
import { ReplaySubject, Observable, ConnectableObservable, Subject } from 'rxjs';
import { File } from '@ionic-native/file';
import * as firebase from 'firebase';

/*
  Generated class for the CompanyProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class CompanyProvider {

  private obs: Observable<firebase.firestore.QuerySnapshot>;
  private companiesSubject: Subject<any> = new Subject()
  public companies$: Observable<any> = this.companiesSubject.publishReplay(1).refCount();

  constructor(
    private afs: AngularFirestore,
    private file: File,
  ) {
    console.log('Hello CompanyProvider Provider');
    const filename = 'companies.json';
    file.checkFile(file.externalCacheDirectory, filename)
    .then(result => {
      console.log(`result = ${result}`)
      if (!result) {
        return this.afs.collection('companies').ref.get()
        .then(query => {
          console.log(`length = ${query.docs.length}`)
          const companies = query.docs.map(e => Object.assign({}, e.data(), {id: e.id})) || [];
          this.file.writeFile(file.externalCacheDirectory, filename, JSON.stringify(companies), {replace: true})
          .then(() => this.companiesSubject.next(companies));
        })
      } else {
        return this.file.readAsText(file.externalCacheDirectory, filename)
        .then(text => JSON.parse(text))
        .then(companies => {
          console.log(`length = ${companies.length}`)
          this.companiesSubject.next(companies)
        });
      }
      // if (result) {
        
      // } else {
      //   this.obs = Observable.fromPromise(this.afs.collection('companies').ref.get()).publishReplay(1).refCount();
      // }
    })
    .catch(err => {
      console.log(err.message || err.code || err)

      this.afs.collection('companies').ref.get()
      .then(query => {
        console.log(`length = ${query.docs.length}`)
        const companies = query.docs.map(e => Object.assign({}, e.data(), {id: e.id})) || [];
        this.file.writeFile(file.externalCacheDirectory, filename, JSON.stringify(companies), {replace: true})
        .then(() => this.companiesSubject.next(companies));
      })
    })
  }

  public all() {
    // return this.obs.map(e => e.docs);
    return this.companies$;
  }

  public byCode(code: string) {
    return this.all()
    .map(e => e.find(_e => _e.id === code))
    // .map(e => e ? e.data(): {})
    .do(e=>console.log(e))
  }

}
