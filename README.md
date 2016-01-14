
Folk from [Finanzchef24-GmbH/tunnel-ssh](https://github.com/Finanzchef24-GmbH/tunnel-ssh)

This folked one is making it work on mac.

Two more options are needed:
```js
{
    tryKeyboard:true,
	"keyboard-interactive":function(name,instructions,instructionsLang,prompts,finish){
		finish([yourpassword]);
	}
} 
```

Add an option in tunnel
```
tunnel(config, options, callback);
options
   try:boolean // try connection after setup tunnel
   size:number // create how many sshconnection after setup tunnel
```

Note that, finish args is an array corresponding to prompts array.