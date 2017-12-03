import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { AngularFirestore } from 'angularfire2/firestore';
import { ReplaySubject, Observable, ConnectableObservable, Subject } from 'rxjs';
import { File } from '@ionic-native/file';
import * as firebase from 'firebase';
import * as moment from 'moment';

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
  private readonly filename = 'companies.json';

  constructor(
    private afs: AngularFirestore,
    private file: File,
  ) {
    console.log('Hello CompanyProvider Provider');
    file.checkFile(file.externalCacheDirectory, this.filename)
    .then(result => {
      console.log(`result = ${result}`)
      if (!result) {
        this.replaceFile()
      } else {
        this.modificationDate(this.filename)
        .then(time => {
          console.log(time.toISOString());
          if (time.isBefore(moment().subtract(7, 'days'))) {
            return this.replaceFile();
          }
          return this.file.readAsText(file.externalCacheDirectory, this.filename)
          .then(text => JSON.parse(text))
          .then(companies => {
            console.log(`length = ${companies.length}`)
            this.companiesSubject.next(companies)
          });
        })
      }
    })
    .catch(err => {
      console.log(err.message || err.code || err)
      this.replaceFile()
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

  private replaceFile() {
    console.log('replacing companies.json...');
    this.afs.collection('companies').ref.get()
    .then(query => {
      const companies = query.docs.map(e => Object.assign({}, e.data(), {id: e.id})) || [];
      this.file.writeFile(this.file.externalCacheDirectory, this.filename, JSON.stringify(companies), {replace: true})
      .then(() => this.companiesSubject.next(companies));
    })
  }

  private modificationDate(filename) {
    return this.file.resolveDirectoryUrl(this.file.externalCacheDirectory)
    .then(dir => this.file.getFile(dir, filename, {}))
    .then(entry => new Promise<moment.Moment>((resolve, reject) => entry.getMetadata(meta => resolve(moment(meta.modificationTime)), err => reject(err))))
  }

}
