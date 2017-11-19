import { Component, ViewChild } from '@angular/core';
import { NavController, Platform } from 'ionic-angular';
import { DocumentListPage } from "../document-list/document-list";
import { SettingPage } from "../setting/setting";
import { DocumentStreamPage } from '../document-stream/document-stream';
import { ListTopicsPage } from '../list-topics/list-topics';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  tab = {
    document: DocumentStreamPage,
    topics: ListTopicsPage,
    setting: SettingPage,
  }

  @ViewChild('myNav') nav: NavController;

  constructor(platform: Platform ) {
  }

}
