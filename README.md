
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

Note that, finish args is an array corresponding to prompts array.