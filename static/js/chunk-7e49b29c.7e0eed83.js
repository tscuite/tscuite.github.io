(window["webpackJsonp"]=window["webpackJsonp"]||[]).push([["chunk-7e49b29c","chunk-2d0ba70d"],{"36e9":function(e,t,r){"use strict";r.r(t),r.d(t,"initDB",(function(){return o})),r.d(t,"checkDB",(function(){return s}));var a=r("b775"),o=function(e){return Object(a["default"])({url:"/init/initdb",method:"post",data:e})},s=function(){return Object(a["default"])({url:"/init/checkdb",method:"post"})}},"4fa3":function(e,t,r){"use strict";r.r(t);var a=function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("div",{staticClass:"init"},[r("p",{staticClass:"in-one a-fadeinT"},[e._v("欢迎使用GIN-VUE-ADMIN")]),r("p",{staticClass:"in-two a-fadeinT"},[e._v("您需要初始化您的数据库并且填充初始数据")]),r("div",{staticClass:"form-card in-three a-fadeinB"},[r("el-form",{ref:"form",attrs:{model:e.form,"label-width":"100px"}},[r("el-form-item",{attrs:{label:"数据库类型"}},[r("el-select",{attrs:{disabled:"",placeholder:"请选择"},model:{value:e.form.sqlType,callback:function(t){e.$set(e.form,"sqlType",t)},expression:"form.sqlType"}},[r("el-option",{key:"mysql",attrs:{label:"mysql(目前只支持mysql)",value:"mysql"}})],1)],1),r("el-form-item",{attrs:{label:"host"}},[r("el-input",{attrs:{placeholder:"请输入数据库链接"},model:{value:e.form.host,callback:function(t){e.$set(e.form,"host",t)},expression:"form.host"}})],1),r("el-form-item",{attrs:{label:"port"}},[r("el-input",{attrs:{placeholder:"请输入数据库端口"},model:{value:e.form.port,callback:function(t){e.$set(e.form,"port",t)},expression:"form.port"}})],1),r("el-form-item",{attrs:{label:"userName"}},[r("el-input",{attrs:{placeholder:"请输入数据库用户名"},model:{value:e.form.userName,callback:function(t){e.$set(e.form,"userName",t)},expression:"form.userName"}})],1),r("el-form-item",{attrs:{label:"password"}},[r("el-input",{attrs:{placeholder:"请输入数据库密码（没有则为空）"},model:{value:e.form.password,callback:function(t){e.$set(e.form,"password",t)},expression:"form.password"}})],1),r("el-form-item",{attrs:{label:"dbName"}},[r("el-input",{attrs:{placeholder:"请输入数据库名称"},model:{value:e.form.dbName,callback:function(t){e.$set(e.form,"dbName",t)},expression:"form.dbName"}})],1),r("el-form-item",[r("div",{staticStyle:{"text-align":"right"}},[r("el-button",{attrs:{type:"primary"},on:{click:e.onSubmit}},[e._v("立即初始化")])],1)])],1)],1)])},o=[],s=(r("96cf"),r("1da1")),l=r("36e9"),n={name:"Init",data:function(){return{form:{sqlType:"mysql",host:"127.0.0.1",port:"3306",userName:"root",password:"",dbName:"gva"}}},methods:{onSubmit:function(){var e=this;return Object(s["a"])(regeneratorRuntime.mark((function t(){var r,a;return regeneratorRuntime.wrap((function(t){while(1)switch(t.prev=t.next){case 0:return r=e.$loading({lock:!0,text:"正在初始化数据库，请稍候",spinner:"el-icon-loading",background:"rgba(0, 0, 0, 0.7)"}),t.prev=1,t.next=4,Object(l["initDB"])(e.form);case 4:a=t.sent,0===a.code&&(e.$message({type:"success",message:a.msg}),e.$router.push({name:"Login"})),r.close(),t.next=12;break;case 9:t.prev=9,t.t0=t["catch"](1),r.close();case 12:case"end":return t.stop()}}),t,null,[[1,9]])})))()}}},i=n,c=(r("f02a"),r("2877")),m=Object(c["a"])(i,a,o,!1,null,null,null);t["default"]=m.exports},"626b":function(e,t,r){},f02a:function(e,t,r){"use strict";var a=r("626b"),o=r.n(a);o.a}}]);